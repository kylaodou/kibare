package bf.yaaba.service;

import bf.yaaba.config.YaabaProperties;
import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.domain.Notification;
import bf.yaaba.domain.User;
import bf.yaaba.repo.Repositories.UserRepository;
import bf.yaaba.web.Dto.AuthView;
import bf.yaaba.web.Dto.LoginRequest;
import bf.yaaba.web.Dto.ProfileRequest;
import bf.yaaba.web.Dto.RegisterRequest;
import bf.yaaba.web.Dto.UserView;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Inscription, connexion (jeton JWT) et profil ; crée le compte administrateur au démarrage. */
@Service
@Order(0)
public class AuthService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtEncoder jwt;
    private final YaabaProperties props;
    private final NotificationService notifications;
    private final ActivityService activity;
    private final MailService mail;
    private final Secrets secrets;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtEncoder jwt, YaabaProperties props,
                       NotificationService notifications, ActivityService activity, MailService mail, Secrets secrets) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.props = props;
        this.notifications = notifications;
        this.activity = activity;
        this.mail = mail;
        this.secrets = secrets;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String email = props.admin().email().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) return;
        User admin = new User();
        admin.setName(props.admin().name());
        admin.setEmail(email);
        admin.setPasswordHash(encoder.encode(props.admin().password()));
        admin.setRole(User.Role.ADMIN);
        users.save(admin);
        log.info("Compte administrateur créé : {}", email);
    }

    /** Règle commune (inscription, réinitialisation) : 8 caractères au moins, dont une lettre et un chiffre. */
    public static void checkPassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 100
                || !password.chars().anyMatch(Character::isLetter) || !password.chars().anyMatch(Character::isDigit))
            throw new IllegalArgumentException("Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre");
    }

    @Transactional
    public AuthView register(RegisterRequest req) {
        checkPassword(req.password());
        String email = req.email().strip().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) throw new ConflictException("Un compte existe déjà avec cet e-mail");
        User u = new User();
        u.setName(req.name().strip());
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(req.password()));
        u.setRegion(req.region());
        u.setLanguage(req.language());
        u.setLastLoginAt(Instant.now());
        u.setEmailVerified(false);
        users.save(u);
        activity.log(ActivityEvent.Kind.SIGNUP, null, null);
        notifications.toAdmins(Notification.Type.NEW_USER, u.getName() + " vient de rejoindre KIBARE", "/admin/utilisateurs");
        boolean sent = sendVerification(u);
        return new AuthView(token(u), UserView.of(u), sent);
    }

    /**
     * Envoie (ou renvoie) le lien de vérification de l'adresse e-mail, valable 24 h.
     * Seule l'empreinte du jeton est enregistrée. Renvoie false si l'e-mail n'a pas pu partir.
     */
    @Transactional
    public boolean sendVerification(User u) {
        String token = secrets.randomToken();
        u.setVerifyTokenHash(secrets.hash(token));
        u.setVerifyExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        users.save(u);
        try {
            mail.send(u.getEmail(), "Confirmez votre adresse e-mail — KIBARE", "Bienvenue sur KIBARE, " + u.getName() + " !",
                    List.of("Merci de rejoindre les gardiens des histoires du Burkina Faso.",
                            "Pour confirmer votre adresse e-mail et pouvoir proposer des contes ou prêter votre voix, cliquez sur le bouton ci-dessous. Ce lien est valable 24 heures."),
                    null, new String[] {"Confirmer mon adresse", mail.appUrl() + "/verifier-email?jeton=" + token});
            return true;
        } catch (MailService.MailDeliveryException e) {
            return false;
        }
    }

    /** Renvoi du lien depuis l'espace personnel. */
    @Transactional
    public void resendVerification() {
        User u = current();
        if (u.isEmailVerified()) throw new ConflictException("Votre adresse e-mail est déjà confirmée");
        if (!sendVerification(u)) throw new MailService.MailDeliveryException("L'e-mail n'a pas pu être envoyé. Réessayez plus tard.", null);
    }

    /** Lien cliqué dans l'e-mail : l'adresse est confirmée si le jeton est valide et non expiré. */
    @Transactional
    public UserView verifyEmail(String token) {
        User u = users.findByVerifyTokenHash(secrets.hash(token))
                .filter(x -> x.getVerifyExpiresAt() != null && x.getVerifyExpiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> new IllegalArgumentException("Ce lien de confirmation est invalide ou a expiré"));
        u.setEmailVerified(true);
        u.setVerifyTokenHash(null);
        u.setVerifyExpiresAt(null);
        return UserView.of(u);
    }

    @Transactional
    public AuthView login(LoginRequest req) {
        User found = users.findByEmailIgnoreCase(req.email().strip()).orElse(null);
        // compte créé avec Google sans mot de passe : on l'indique clairement
        if (found != null && !found.hasPassword())
            throw new UnauthorizedException("Ce compte a été créé avec Google : utilisez « Continuer avec Google », "
                    + "ou choisissez un mot de passe avec « Mot de passe oublié ? ».");
        User u = java.util.Optional.ofNullable(found)
                .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
                .orElseThrow(() -> new UnauthorizedException("E-mail ou mot de passe incorrect"));
        if (!u.isActive()) throw new UnauthorizedException("Ce compte a été désactivé");
        u.setLastLoginAt(Instant.now());
        return new AuthView(token(u), UserView.of(u), null);
    }

    /** Définir (compte Google) ou changer (avec l'actuel) son mot de passe. */
    @Transactional
    public UserView changePassword(String currentPassword, String newPassword) {
        User u = current();
        if (u.hasPassword() && (currentPassword == null || !encoder.matches(currentPassword, u.getPasswordHash())))
            throw new IllegalArgumentException("Le mot de passe actuel est incorrect");
        checkPassword(newPassword);
        u.setPasswordHash(encoder.encode(newPassword));
        u.setPasswordSet(true);
        return UserView.of(u);
    }

    @Transactional
    public UserView updateProfile(ProfileRequest req) {
        User u = current();
        u.setName(req.name().strip());
        u.setRegion(req.region());
        u.setLanguage(req.language());
        u.setBio(req.bio() == null ? null : req.bio().strip());
        return UserView.of(u);
    }

    /** Utilisateur authentifié de la requête en cours. */
    @Transactional(readOnly = true)
    public User current() {
        Long id = currentId();
        if (id == null) throw new UnauthorizedException("Connexion requise");
        return users.findById(id).filter(User::isActive).orElseThrow(() -> new UnauthorizedException("Compte introuvable"));
    }

    public Long currentId() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a instanceof JwtAuthenticationToken t) return Long.valueOf(t.getToken().getSubject());
        return null;
    }

    public boolean isAdmin() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getAuthorities().stream().anyMatch(g -> g.getAuthority().equals("ROLE_ADMIN"));
    }

    /** Jeton de session KIBARE (aussi utilisé par la connexion Google). */
    String token(User u) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("yaaba")
                .subject(String.valueOf(u.getId()))
                .issuedAt(now)
                .expiresAt(now.plus(props.jwtHours(), ChronoUnit.HOURS))
                .claim("name", u.getName())
                .claim("role", u.getRole().name())
                .build();
        return jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
}

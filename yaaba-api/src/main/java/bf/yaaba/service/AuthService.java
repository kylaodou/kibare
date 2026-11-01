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

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtEncoder jwt, YaabaProperties props,
                       NotificationService notifications, ActivityService activity) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.props = props;
        this.notifications = notifications;
        this.activity = activity;
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

    @Transactional
    public AuthView register(RegisterRequest req) {
        String email = req.email().strip().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) throw new ConflictException("Un compte existe déjà avec cet e-mail");
        User u = new User();
        u.setName(req.name().strip());
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(req.password()));
        u.setRegion(req.region());
        u.setLanguage(req.language());
        u.setLastLoginAt(Instant.now());
        users.save(u);
        activity.log(ActivityEvent.Kind.SIGNUP, null, null);
        notifications.toAdmins(Notification.Type.NEW_USER, u.getName() + " vient de rejoindre Yaaba", "/admin/utilisateurs");
        return new AuthView(token(u), UserView.of(u));
    }

    @Transactional
    public AuthView login(LoginRequest req) {
        User u = users.findByEmailIgnoreCase(req.email().strip())
                .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
                .orElseThrow(() -> new UnauthorizedException("E-mail ou mot de passe incorrect"));
        if (!u.isActive()) throw new UnauthorizedException("Ce compte a été désactivé");
        u.setLastLoginAt(Instant.now());
        return new AuthView(token(u), UserView.of(u));
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

    private String token(User u) {
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

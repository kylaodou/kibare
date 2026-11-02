package bf.yaaba.service;

import bf.yaaba.config.YaabaProperties;
import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.domain.Notification;
import bf.yaaba.domain.User;
import bf.yaaba.repo.Repositories.UserRepository;
import bf.yaaba.web.Dto.AuthView;
import bf.yaaba.web.Dto.GoogleConfigView;
import bf.yaaba.web.Dto.UserView;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Connexion avec Google (Google Identity Services, gratuit).
 * Le navigateur obtient un jeton d'identité signé par Google ; il est vérifié ici avec les clés publiques
 * de Google (signature, émetteur, audience = notre identifiant client, expiration, adresse vérifiée).
 * Un compte existant avec la même adresse est lié ; sinon un compte est créé (adresse déjà vérifiée par Google).
 */
@Service
public class GoogleAuthService {

    private static final String JWKS = "https://www.googleapis.com/oauth2/v3/certs";
    private static final List<String> ISSUERS = List.of("accounts.google.com", "https://accounts.google.com");

    private final YaabaProperties props;
    private final UserRepository users;
    private final AuthService auth;
    private final PasswordEncoder encoder;
    private final Secrets secrets;
    private final NotificationService notifications;
    private final ActivityService activity;
    private final PasswordResetService resets;
    private volatile NimbusJwtDecoder decoder;

    public GoogleAuthService(YaabaProperties props, UserRepository users, AuthService auth, PasswordEncoder encoder,
                             Secrets secrets, NotificationService notifications, ActivityService activity,
                             PasswordResetService resets) {
        this.resets = resets;
        this.props = props;
        this.users = users;
        this.auth = auth;
        this.encoder = encoder;
        this.secrets = secrets;
        this.notifications = notifications;
        this.activity = activity;
    }

    private String clientId() {
        String id = props.google() == null ? null : props.google().clientId();
        return id == null ? "" : id.strip();
    }

    public GoogleConfigView config() {
        String id = clientId();
        return new GoogleConfigView(!id.isEmpty(), id.isEmpty() ? null : id);
    }

    @Transactional
    public AuthView signIn(String credential) {
        if (clientId().isEmpty()) throw new IllegalArgumentException("La connexion avec Google n'est pas configurée sur ce serveur");
        Jwt token;
        try {
            token = decoder().decode(credential);
        } catch (JwtException e) {
            throw new UnauthorizedException("Connexion Google refusée : jeton invalide ou expiré");
        }
        String sub = token.getSubject();
        String rawEmail = token.getClaimAsString("email");
        if (sub == null || rawEmail == null || !Boolean.TRUE.equals(token.getClaim("email_verified")))
            throw new UnauthorizedException("Votre adresse Google n'est pas vérifiée");
        String email = rawEmail.strip().toLowerCase(Locale.ROOT);

        boolean created = false;
        User u = users.findByGoogleId(sub).or(() -> users.findByEmailIgnoreCase(email)).orElse(null);
        if (u == null) {
            u = new User();
            String name = token.getClaimAsString("name");
            u.setName(name == null || name.isBlank() ? email.substring(0, email.indexOf('@')) : name.strip());
            u.setEmail(email);
            // pas de mot de passe connu : un secret aléatoire, remplaçable via « mot de passe oublié »
            u.setPasswordHash(encoder.encode(secrets.randomToken()));
            u.setGoogleId(sub);
            u.setEmailVerified(true);
            u.setPasswordSet(false);
            users.save(u);
            created = true;
            activity.log(ActivityEvent.Kind.SIGNUP, null, null);
            notifications.toAdmins(Notification.Type.NEW_USER, u.getName() + " vient de rejoindre KIBARE (Google)", "/admin/utilisateurs");
        } else {
            if (u.getGoogleId() == null) {
                u.setGoogleId(sub);
                if (u.hasPassword()) u.setPasswordSet(true); // compte existant : son mot de passe reste valable
            }
            u.setEmailVerified(true); // Google a vérifié l'adresse
        }
        if (!u.isActive()) throw new UnauthorizedException("Ce compte a été désactivé");
        u.setLastLoginAt(Instant.now());
        // e-mail de bienvenue avec le lien pour choisir un mot de passe (l'échec d'envoi n'empêche pas la connexion)
        Boolean sent = created ? resets.sendWelcomeSetup(u) : null;
        return new AuthView(auth.token(u), UserView.of(u), sent);
    }

    private NimbusJwtDecoder decoder() {
        if (decoder == null) {
            NimbusJwtDecoder d = NimbusJwtDecoder.withJwkSetUri(JWKS).build();
            String aud = clientId();
            OAuth2TokenValidator<Jwt> issuer = jwt -> ISSUERS.contains(String.valueOf(jwt.getClaimAsString("iss")))
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Émetteur inattendu", null));
            OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience() != null && jwt.getAudience().contains(aud)
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Audience inattendue", null));
            d.setJwtValidator(new DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(), issuer, audience));
            decoder = d;
        }
        return decoder;
    }
}

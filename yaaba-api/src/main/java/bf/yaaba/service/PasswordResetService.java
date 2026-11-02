package bf.yaaba.service;

import bf.yaaba.domain.PasswordReset;
import bf.yaaba.domain.User;
import bf.yaaba.repo.Repositories.PasswordResetRepository;
import bf.yaaba.repo.Repositories.UserRepository;
import bf.yaaba.web.Dto.ResetTokenView;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Réinitialisation du mot de passe en trois temps :
 * <ol>
 *   <li>demande : un code à 6 chiffres, valable exactement 5 minutes, est envoyé par e-mail ;</li>
 *   <li>vérification : 5 essais au plus ; un code accepté remet un jeton valable 10 minutes ;</li>
 *   <li>nouveau mot de passe : le jeton est consommé, la demande est close.</li>
 * </ol>
 * La réponse à la demande est identique que le compte existe ou non. Seules des empreintes sont stockées.
 */
@Service
public class PasswordResetService {

    public static final Duration CODE_TTL = Duration.ofMinutes(5);
    static final Duration TOKEN_TTL = Duration.ofMinutes(10);
    static final Duration SETUP_TTL = Duration.ofDays(7);
    static final Duration MIN_INTERVAL = Duration.ofSeconds(60);
    static final int MAX_PER_HOUR = 5;
    static final int MAX_ATTEMPTS = 5;
    private static final String INVALID = "Code invalide ou expiré";

    private final UserRepository users;
    private final PasswordResetRepository resets;
    private final PasswordEncoder encoder;
    private final MailService mail;
    private final Secrets secrets;

    public PasswordResetService(UserRepository users, PasswordResetRepository resets, PasswordEncoder encoder,
                                MailService mail, Secrets secrets) {
        this.users = users;
        this.resets = resets;
        this.encoder = encoder;
        this.mail = mail;
        this.secrets = secrets;
    }

    /** Étape 1. Ne révèle jamais si l'adresse correspond à un compte. */
    @Transactional
    public void request(String email) {
        if (!mail.available()) throw new MailService.MailDeliveryException("Aucun service d'e-mail n'est configuré sur le serveur.", null);
        User u = users.findByEmailIgnoreCase(email.strip().toLowerCase(Locale.ROOT)).filter(User::isActive).orElse(null);
        if (u == null) return;
        Instant now = Instant.now();
        // limitation : une demande par minute, cinq par heure (au-delà, réponse identique mais pas d'envoi)
        PasswordReset last = resets.findFirstByUserIdOrderByCreatedAtDesc(u.getId()).orElse(null);
        if (last != null && last.getCreatedAt().isAfter(now.minus(MIN_INTERVAL))) return;
        if (resets.countByUserIdAndCreatedAtAfter(u.getId(), now.minus(Duration.ofHours(1))) >= MAX_PER_HOUR) return;
        if (last != null && !last.isConsumed()) {
            last.setUsed(true); // un seul code actif à la fois
            last.setConsumed(true);
        }
        String code = secrets.sixDigits();
        resets.save(new PasswordReset(u.getId(), secrets.hash(u.getId() + ":" + code), now.plus(CODE_TTL)));
        mail.send(u.getEmail(), "Votre code de réinitialisation — KIBARE", "Réinitialisation du mot de passe",
                List.of("Bonjour " + u.getName() + ",",
                        "Voici votre code pour choisir un nouveau mot de passe. Il est valable 5 minutes et ne peut servir qu'une fois.",
                        "Ne le communiquez à personne : l'équipe KIBARE ne vous le demandera jamais."),
                code, null);
    }

    /** Étape 2. Un code faux, expiré ou déjà utilisé ne donne jamais accès au changement de mot de passe. */
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public ResetTokenView verify(String email, String code) {
        User u = users.findByEmailIgnoreCase(email.strip().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new IllegalArgumentException(INVALID));
        PasswordReset r = resets.findFirstByUserIdOrderByCreatedAtDesc(u.getId()).orElseThrow(() -> new IllegalArgumentException(INVALID));
        if (r.isUsed() || r.isConsumed() || r.getExpiresAt().isBefore(Instant.now()) || r.getAttempts() >= MAX_ATTEMPTS)
            throw new IllegalArgumentException(INVALID);
        r.setAttempts(r.getAttempts() + 1);
        if (!secrets.same(r.getCodeHash(), secrets.hash(u.getId() + ":" + code.strip()))) {
            int left = MAX_ATTEMPTS - r.getAttempts();
            throw new IllegalArgumentException(left > 0 ? INVALID + " (" + left + " essai(s) restant(s))" : INVALID + " : demandez un nouveau code");
        }
        r.setUsed(true);
        String token = secrets.randomToken();
        r.setResetTokenHash(secrets.hash(token));
        r.setResetTokenExpiresAt(Instant.now().plus(TOKEN_TTL));
        return new ResetTokenView(token, TOKEN_TTL.toSeconds());
    }

    /**
     * Lien « choisir mon mot de passe » envoyé à l'inscription avec Google : jeton à usage unique, valable 7 jours,
     * consommé par l'étape 3. Seule son empreinte est stockée. Renvoie false si l'e-mail n'a pas pu partir.
     */
    @Transactional
    public boolean sendWelcomeSetup(User u) {
        String token = secrets.randomToken();
        PasswordReset r = new PasswordReset(u.getId(), secrets.hash(u.getId() + ":setup:" + token), Instant.now());
        r.setUsed(true); // pas de code à saisir : le lien remplace l'étape 2
        r.setResetTokenHash(secrets.hash(token));
        r.setResetTokenExpiresAt(Instant.now().plus(SETUP_TTL));
        resets.save(r);
        try {
            mail.send(u.getEmail(), "Bienvenue sur KIBARE — choisissez votre mot de passe", "Bienvenue sur KIBARE, " + u.getName() + " !",
                    List.of("Votre compte a été créé avec Google. Vous pouvez désormais écouter les contes, prêter votre voix et partager vos récits.",
                            "Pour pouvoir aussi vous connecter avec votre adresse e-mail et un mot de passe, choisissez-en un ci-dessous. "
                                    + "Ce lien personnel est valable 7 jours et ne fonctionne qu'une fois.",
                            "Vous pouvez aussi continuer à vous connecter simplement avec « Continuer avec Google »."),
                    null, new String[] {"Choisir mon mot de passe", mail.appUrl() + "/definir-mot-de-passe?jeton=" + token});
            return true;
        } catch (MailService.MailDeliveryException e) {
            return false;
        }
    }

    /** Étape 3. Le mot de passe est haché par le même encodeur que l'inscription. */
    @Transactional
    public void reset(String resetToken, String password) {
        PasswordReset r = resets.findByResetTokenHash(secrets.hash(resetToken.strip()))
                .filter(x -> !x.isConsumed() && x.getResetTokenExpiresAt() != null && x.getResetTokenExpiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> new IllegalArgumentException("La demande a expiré : recommencez la réinitialisation"));
        AuthService.checkPassword(password);
        User u = users.findById(r.getUserId()).orElseThrow(() -> new IllegalArgumentException("Compte introuvable"));
        u.setPasswordHash(encoder.encode(password));
        u.setPasswordSet(true);
        r.setConsumed(true);
        r.setResetTokenHash(null);
    }
}

package bf.yaaba.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Paramètres propres à Yaaba (section « yaaba » de application.yml). */
@ConfigurationProperties(prefix = "yaaba")
public record YaabaProperties(String storageDir, List<String> corsOrigins, Admin admin, String jwtSecret, int jwtHours,
                              Mail mail, Google google, String cloudinaryUrl) {

    /** Compte administrateur créé au premier démarrage. */
    public record Admin(String email, String password, String name) {}

    /**
     * Envoi des e-mails. Sans serveur SMTP configuré (spring.mail.host vide), les messages sont déposés
     * dans {@code outboxDir} (dossier privé du serveur) : pratique en développement, jamais exposé au public.
     *
     * @param from adresse d'expédition
     * @param appUrl adresse du site, pour les liens des e-mails
     * @param outboxDir dossier de dépôt quand aucun SMTP n'est configuré ; vide = envoi impossible
     * @param requireVerified exiger un e-mail vérifié pour contribuer
     */
    public record Mail(String from, String appUrl, String outboxDir, boolean requireVerified, String brevoApiKey) {}

    /**
     * Connexion avec Google (gratuite) : identifiant client OAuth « application Web » créé dans Google Cloud Console.
     * Vide = bouton « Continuer avec Google » masqué. L'identifiant client n'est pas un secret.
     */
    public record Google(String clientId) {}
}

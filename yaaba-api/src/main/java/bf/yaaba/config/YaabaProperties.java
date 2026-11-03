package bf.yaaba.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Paramètres propres à Yaaba (section « yaaba » de application.yml). */
@ConfigurationProperties(prefix = "yaaba")
public record YaabaProperties(String storageDir, List<String> corsOrigins, Admin admin, String jwtSecret, int jwtHours,
                              Mail mail, Google google, String cloudinaryUrl) {

    /** Compte administrateur créé au premier démarrage. */
    public record Admin(String email, String password, String name) {}

    /** Envoi des e-mails. */
    public record Mail(String from, String appUrl, String outboxDir, boolean requireVerified, String brevoApiKey) {}

    /** Connexion avec Google (gratuite) : identifiant client OAuth « application Web » créé dans Google Cloud Console. */
    public record Google(String clientId) {}
}

package bf.yaaba.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Paramètres propres à Yaaba (section « yaaba » de application.yml). */
@ConfigurationProperties(prefix = "yaaba")
public record YaabaProperties(String storageDir, List<String> corsOrigins, Admin admin, String jwtSecret, int jwtHours) {

    /** Compte administrateur créé au premier démarrage. */
    public record Admin(String email, String password, String name) {}
}

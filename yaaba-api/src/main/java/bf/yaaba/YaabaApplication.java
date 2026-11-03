package bf.yaaba;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** Yaaba — plateforme multimédia des contes et légendes du Burkina Faso. */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableJpaRepositories(considerNestedRepositories = true)
public class YaabaApplication {

    public static void main(String[] args) {
        SpringApplication.run(YaabaApplication.class, args);
    }
}

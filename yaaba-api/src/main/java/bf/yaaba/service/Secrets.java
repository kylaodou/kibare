package bf.yaaba.service;

import bf.yaaba.config.YaabaProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/** Jetons aléatoires, codes à usage unique et empreintes HMAC (on ne stocke jamais un secret en clair). */
@Component
public class Secrets {

    private final SecureRandom random = new SecureRandom();
    private final SecretKeySpec key;

    public Secrets(YaabaProperties props) {
        this.key = new SecretKeySpec(("kibare-secrets:" + props.jwtSecret()).getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    /** Jeton opaque de 256 bits, utilisable dans une URL. */
    public String randomToken() {
        byte[] b = new byte[32];
        random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /** Code numérique à 6 chiffres (000000 à 999999). */
    public String sixDigits() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    /** Empreinte HMAC-SHA256 (hexadécimal, 64 caractères). */
    public String hash(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC indisponible", e);
        }
    }

    /** Comparaison en temps constant de deux empreintes. */
    public boolean same(String a, String b) {
        return a != null && b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}

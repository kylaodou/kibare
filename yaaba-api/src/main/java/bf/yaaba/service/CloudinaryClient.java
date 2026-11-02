package bf.yaaba.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Envoi des voix et vidéos vers Cloudinary (offre gratuite), par son API REST signée :
 * les fichiers survivent aux redémarrages de l'hébergeur. Configuré par CLOUDINARY_URL
 * (« cloudinary://clé:secret@nom-du-cloud », fournie par le tableau de bord Cloudinary).
 * Audio et vidéo utilisent le type de ressource « video » de Cloudinary.
 */
class CloudinaryClient {

    private static final Pattern URL = Pattern.compile("cloudinary://([^:]+):([^@]+)@(.+)");
    private static final Pattern PUBLIC_ID = Pattern.compile("/upload/(?:v\\d+/)?(.+?)(?:\\.[a-z0-9]{2,4})?$");

    private final String key;
    private final String secret;
    private final String cloud;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    private final ObjectMapper json = new ObjectMapper();

    private CloudinaryClient(String key, String secret, String cloud) {
        this.key = key;
        this.secret = secret;
        this.cloud = cloud;
    }

    /** null si l'URL est absente ou mal formée (stockage sur disque). */
    static CloudinaryClient from(String url) {
        if (url == null || url.isBlank()) return null;
        Matcher m = URL.matcher(url.strip());
        if (!m.matches()) throw new IllegalStateException("CLOUDINARY_URL invalide : attendu cloudinary://clé:secret@nom-du-cloud");
        return new CloudinaryClient(m.group(1), m.group(2), m.group(3));
    }

    /** Envoie le fichier ; renvoie son adresse publique HTTPS. */
    String upload(byte[] data, String fileName, String contentType) {
        String publicId = "kibare/" + UUID.randomUUID();
        Map<String, String> params = signed(Map.of("public_id", publicId));
        String boundary = "----kibare" + UUID.randomUUID();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        try {
            for (var e : params.entrySet()) {
                body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + e.getKey() + "\"\r\n\r\n"
                        + e.getValue() + "\r\n").getBytes(StandardCharsets.UTF_8));
            }
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + fileName
                    + "\"\r\nContent-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(data);
            body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            HttpRequest req = HttpRequest.newBuilder(URI.create("https://api.cloudinary.com/v1_1/" + cloud + "/video/upload"))
                    .timeout(Duration.ofMinutes(2))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode r = json.readTree(res.body());
            if (res.statusCode() / 100 != 2 || !r.hasNonNull("secure_url"))
                throw new IllegalStateException("Envoi du fichier impossible (Cloudinary " + res.statusCode() + ")");
            return r.get("secure_url").asText();
        } catch (IOException e) {
            throw new IllegalStateException("Envoi du fichier impossible", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Envoi du fichier interrompu", e);
        }
    }

    /** Supprime le fichier désigné par son adresse Cloudinary (sans erreur bloquante). */
    void delete(String url) {
        Matcher m = PUBLIC_ID.matcher(url);
        if (!url.contains("res.cloudinary.com/" + cloud + "/") || !m.find()) return;
        Map<String, String> params = signed(Map.of("public_id", m.group(1)));
        StringBuilder form = new StringBuilder();
        params.forEach((k, v) -> form.append(form.isEmpty() ? "" : "&").append(k).append('=')
                .append(java.net.URLEncoder.encode(v, StandardCharsets.UTF_8)));
        try {
            http.send(HttpRequest.newBuilder(URI.create("https://api.cloudinary.com/v1_1/" + cloud + "/video/destroy"))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form.toString())).build(), HttpResponse.BodyHandlers.discarding());
        } catch (IOException e) {
            // fichier orphelin : non bloquant
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** Paramètres signés : SHA-1 des paramètres triés suivis du secret (signature Cloudinary). */
    private Map<String, String> signed(Map<String, String> extra) {
        TreeMap<String, String> p = new TreeMap<>(extra);
        p.put("timestamp", String.valueOf(System.currentTimeMillis() / 1000));
        StringBuilder toSign = new StringBuilder();
        p.forEach((k, v) -> toSign.append(toSign.isEmpty() ? "" : "&").append(k).append('=').append(v));
        try {
            byte[] sha = MessageDigest.getInstance("SHA-1").digest((toSign + secret).getBytes(StandardCharsets.UTF_8));
            p.put("signature", HexFormat.of().formatHex(sha));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        p.put("api_key", key);
        return p;
    }
}

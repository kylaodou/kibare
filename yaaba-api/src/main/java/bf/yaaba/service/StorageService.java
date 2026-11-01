package bf.yaaba.service;

import bf.yaaba.config.YaabaProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Stockage des fichiers audio sur disque, sous des noms aléatoires non devinables. */
@Service
public class StorageService {

    private static final Map<String, String> EXTENSIONS = Map.of(
            "audio/webm", "webm",
            "audio/ogg", "ogg",
            "audio/mpeg", "mp3",
            "audio/mp3", "mp3",
            "audio/mp4", "m4a",
            "audio/x-m4a", "m4a",
            "audio/aac", "aac",
            "audio/wav", "wav",
            "audio/x-wav", "wav",
            "video/webm", "webm");

    private final Path root;

    public StorageService(YaabaProperties props) throws IOException {
        this.root = Path.of(props.storageDir()).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public record Stored(String fileName, String contentType) {}

    public Stored storeAudio(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Fichier audio vide");
        String type = Optional.ofNullable(file.getContentType()).orElse("").toLowerCase(Locale.ROOT);
        String base = type.contains(";") ? type.substring(0, type.indexOf(';')).trim() : type;
        String ext = EXTENSIONS.get(base);
        if (ext == null) throw new IllegalArgumentException("Format audio non pris en charge : " + type);
        String name = UUID.randomUUID() + "." + ext;
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, root.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IllegalStateException("Impossible d'enregistrer le fichier", e);
        }
        return new Stored(name, base.equals("video/webm") ? "audio/webm" : base);
    }

    public Optional<Resource> load(String fileName) {
        if (!fileName.matches("[a-f0-9\\-]{36}\\.[a-z0-9]{2,4}")) return Optional.empty();
        Path p = root.resolve(fileName).normalize();
        if (!p.startsWith(root) || !Files.exists(p)) return Optional.empty();
        return Optional.of(new PathResource(p));
    }

    public void delete(String fileName) {
        if (fileName == null) return;
        try {
            Path p = root.resolve(fileName).normalize();
            if (p.startsWith(root)) Files.deleteIfExists(p);
        } catch (IOException ignored) {
            // un fichier orphelin n'est pas bloquant
        }
    }

    public static String mediaUrl(String fileName) {
        return fileName == null ? null : "/api/media/" + fileName;
    }
}

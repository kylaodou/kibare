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

/** Stockage des voix et vidéos, sous des noms aléatoires non devinables : sur Cloudinary si CLOUDINARY_URL est définie (hébergement sans disque persistant), sinon sur disque. */
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
    private final CloudinaryClient cloud;

    public StorageService(YaabaProperties props) throws IOException {
        this.root = Path.of(props.storageDir()).toAbsolutePath().normalize();
        Files.createDirectories(root);
        this.cloud = CloudinaryClient.from(props.cloudinaryUrl());
    }

    /** Écrit le fichier sur Cloudinary ou sur disque ; renvoie l'adresse ou le nom enregistré. */
    private String write(MultipartFile file, String ext, String contentType) {
        String name = UUID.randomUUID() + "." + ext;
        try {
            if (cloud != null) return cloud.upload(file.getBytes(), name, contentType);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, root.resolve(name), StandardCopyOption.REPLACE_EXISTING);
            }
            return name;
        } catch (IOException e) {
            throw new IllegalStateException("Impossible d'enregistrer le fichier", e);
        }
    }

    public record Stored(String fileName, String contentType) {}

    public Stored storeAudio(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Fichier audio vide");
        String type = Optional.ofNullable(file.getContentType()).orElse("").toLowerCase(Locale.ROOT);
        String base = type.contains(";") ? type.substring(0, type.indexOf(';')).trim() : type;
        String ext = EXTENSIONS.get(base);
        if (ext == null) throw new IllegalArgumentException("Format audio non pris en charge : " + type);
        String type2 = base.equals("video/webm") ? "audio/webm" : base;
        return new Stored(write(file, ext, type2), type2);
    }

    /** Taille maximale d'une vidéo d'illustration. */
    public static final long MAX_VIDEO_BYTES = 10L * 1024 * 1024;

    private static final Map<String, String> VIDEO = Map.of("video/mp4", "mp4", "video/webm", "webm", "video/ogg", "ogv");

    /** Vidéo d'illustration : MP4, WebM ou Ogg, 10 Mo au plus. */
    public Stored storeVideo(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Fichier vidéo vide");
        if (file.getSize() > MAX_VIDEO_BYTES)
            throw new IllegalArgumentException("Vidéo trop volumineuse : " + (file.getSize() / 1024 / 1024) + " Mo (10 Mo maximum)");
        String type = Optional.ofNullable(file.getContentType()).orElse("").toLowerCase(Locale.ROOT);
        String base = type.contains(";") ? type.substring(0, type.indexOf(';')).trim() : type;
        String ext = VIDEO.get(base);
        if (ext == null) throw new IllegalArgumentException("Format vidéo non pris en charge (MP4, WebM ou Ogg) : " + type);
        return new Stored(write(file, ext, base), base);
    }

    public Optional<Resource> load(String fileName) {
        if (!fileName.matches("[a-f0-9\\-]{36}\\.[a-z0-9]{2,4}")) return Optional.empty();
        Path p = root.resolve(fileName).normalize();
        if (!p.startsWith(root) || !Files.exists(p)) return Optional.empty();
        return Optional.of(new PathResource(p));
    }

    public void delete(String fileName) {
        if (fileName == null) return;
        if (fileName.startsWith("https://")) {
            if (cloud != null) cloud.delete(fileName);
            return;
        }
        try {
            Path p = root.resolve(fileName).normalize();
            if (p.startsWith(root)) Files.deleteIfExists(p);
        } catch (IOException ignored) {
            // un fichier orphelin n'est pas bloquant
        }
    }

    public static String mediaUrl(String fileName) {
        if (fileName == null) return null;
        return fileName.startsWith("https://") ? fileName : "/api/media/" + fileName;
    }
}

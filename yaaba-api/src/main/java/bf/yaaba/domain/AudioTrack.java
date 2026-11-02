package bf.yaaba.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/** Enregistrement audio publié d'un conte, dans une langue donnée, par un conteur. */
@Entity
@Table(name = "audio_track", indexes = @Index(columnList = "taleSlug"))
public class AudioTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String taleSlug;

    @Column(nullable = false, length = 30)
    private String lang;

    @Column(nullable = false, length = 120)
    private String narrator;

    @Column(nullable = false)
    private String fileName;

    private String contentType;
    private Long contributionId;

    /** Paragraphe (identifiant stable de la scène) lu par cette voix ; null = conte entier. */
    @Column(length = 140)
    private String sceneId;

    /** Un fichier par paragraphe, quand le conteur a enregistré séquence par séquence (ancien format). */
    @Column(length = 4000)
    private String segments;
    private Instant createdAt = Instant.now();

    protected AudioTrack() {}

    public AudioTrack(String taleSlug, String lang, String narrator, String fileName, String contentType, Long contributionId) {
        this.taleSlug = taleSlug;
        this.lang = lang;
        this.narrator = narrator;
        this.fileName = fileName;
        this.contentType = contentType;
        this.contributionId = contributionId;
    }

    public Long getId() { return id; }
    public String getTaleSlug() { return taleSlug; }
    public String getLang() { return lang; }
    public String getNarrator() { return narrator; }
    public String getFileName() { return fileName; }
    public String getContentType() { return contentType; }
    public Long getContributionId() { return contributionId; }
    public Instant getCreatedAt() { return createdAt; }
    public String getSceneId() { return sceneId; }
    public void setSceneId(String sceneId) { this.sceneId = sceneId; }
    public String getSegments() { return segments; }
    public void setSegments(String segments) { this.segments = segments; }
}

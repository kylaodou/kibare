package bf.yaaba.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Proposition d'un visiteur : une voix pour un conte existant, ou un nouveau conte. */
@Entity
@Table(name = "contribution")
public class Contribution {

    public enum Kind { voice, story }

    public enum Status { PENDING, APPROVED, REJECTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Kind kind;

    private Long userId;

    @Column(length = 120)
    private String taleSlug;

    /** conte publié à partir de cette contribution (récit nouveau validé) */
    @Column(length = 120)
    private String publishedSlug;

    @Column(length = 400)
    private String summary;

    @Column(length = 300)
    private String moral;

    @Column(length = 20)
    private String taleType;

    @Column(length = 500)
    private String reviewNote;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(length = 40)
    private String region;

    @Column(nullable = false, length = 30)
    private String language;

    @Column(nullable = false, length = 80)
    private String authorName;

    @Column(length = 120)
    private String authorEmail;

    @Column(columnDefinition = "TEXT")
    private String text;

    private boolean consent;
    private String audioFile;
    private String audioContentType;

    /** Enregistrements paragraphe par paragraphe (noms de fichiers séparés par des virgules, dans l'ordre). */
    @Column(length = 8000)
    private String segmentFiles;

    /** Paragraphe lu par chaque enregistrement (identifiants de scène, même ordre que segmentFiles). */
    @Column(length = 4000)
    private String segmentScenes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.PENDING;

    private Instant createdAt = Instant.now();
    private Instant reviewedAt;

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getPublishedSlug() { return publishedSlug; }
    public void setPublishedSlug(String publishedSlug) { this.publishedSlug = publishedSlug; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getMoral() { return moral; }
    public void setMoral(String moral) { this.moral = moral; }
    public String getTaleType() { return taleType; }
    public void setTaleType(String taleType) { this.taleType = taleType; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public Kind getKind() { return kind; }
    public void setKind(Kind kind) { this.kind = kind; }
    public String getTaleSlug() { return taleSlug; }
    public void setTaleSlug(String taleSlug) { this.taleSlug = taleSlug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getAuthorEmail() { return authorEmail; }
    public void setAuthorEmail(String authorEmail) { this.authorEmail = authorEmail; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public boolean isConsent() { return consent; }
    public void setConsent(boolean consent) { this.consent = consent; }
    public String getAudioFile() { return audioFile; }
    public void setAudioFile(String audioFile) { this.audioFile = audioFile; }
    public String getAudioContentType() { return audioContentType; }
    public String getSegmentScenes() { return segmentScenes; }
    public void setSegmentScenes(String segmentScenes) { this.segmentScenes = segmentScenes; }
    public String getSegmentFiles() { return segmentFiles; }
    public void setSegmentFiles(String segmentFiles) { this.segmentFiles = segmentFiles; }
    public void setAudioContentType(String audioContentType) { this.audioContentType = audioContentType; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
}

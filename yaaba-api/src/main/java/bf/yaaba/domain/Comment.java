package bf.yaaba.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/** Commentaire d'un utilisateur sur un conte (avec réponses possibles). */
@Entity
@Table(name = "comment", indexes = @Index(columnList = "taleSlug"))
public class Comment {

    public enum Status { VISIBLE, HIDDEN }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String taleSlug;

    @Column(nullable = false)
    private Long userId;

    private Long parentId;

    @Column(nullable = false, length = 2000)
    private String text;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.VISIBLE;

    private Instant createdAt = Instant.now();

    protected Comment() {}

    public Comment(String taleSlug, Long userId, Long parentId, String text) {
        this.taleSlug = taleSlug;
        this.userId = userId;
        this.parentId = parentId;
        this.text = text;
    }

    public Long getId() { return id; }
    public String getTaleSlug() { return taleSlug; }
    public Long getUserId() { return userId; }
    public Long getParentId() { return parentId; }
    public String getText() { return text; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}

package bf.yaaba.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/** Notification adressée à un utilisateur, ou à tous les administrateurs quand userId est null. */
@Entity
@Table(name = "notification", indexes = @Index(columnList = "userId"))
public class Notification {

    public enum Type { NEW_CONTRIBUTION, CONTRIBUTION_APPROVED, CONTRIBUTION_REJECTED, NEW_COMMENT, COMMENT_REPLY, NEW_USER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** destinataire ; null = tous les administrateurs */
    private Long userId;

    @Column(nullable = false, length = 30)
    private Type type;

    @Column(nullable = false, length = 300)
    private String message;

    @Column(length = 200)
    private String link;

    private boolean read;
    private Instant createdAt = Instant.now();

    protected Notification() {}

    public Notification(Long userId, Type type, String message, String link) {
        this.userId = userId;
        this.type = type;
        this.message = message;
        this.link = link;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Type getType() { return type; }
    public String getMessage() { return message; }
    public String getLink() { return link; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public Instant getCreatedAt() { return createdAt; }
}

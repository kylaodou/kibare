package bf.yaaba.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDate;

/** Journal d'activité agrégé par jour (lectures, inscriptions…) pour les graphiques du tableau de bord. */
@Entity
@Table(name = "activity_event", indexes = @Index(columnList = "eventDay"))
public class ActivityEvent {

    public enum Kind { VIEW, LIKE, COMMENT, CONTRIBUTION, SIGNUP, COMPLETE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind kind;

    @Column(length = 120)
    private String taleSlug;

    @Column(length = 30)
    private String lang;

    @Column(name = "event_day", nullable = false)
    private LocalDate eventDay = LocalDate.now();

    protected ActivityEvent() {}

    public ActivityEvent(Kind kind, String taleSlug, String lang) {
        this.kind = kind;
        this.taleSlug = taleSlug;
        this.lang = lang;
    }

    public Long getId() { return id; }
    public Kind getKind() { return kind; }
    public String getTaleSlug() { return taleSlug; }
    public String getLang() { return lang; }
    public LocalDate getDay() { return eventDay; }
}

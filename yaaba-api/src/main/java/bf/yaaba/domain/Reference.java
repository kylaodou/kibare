package bf.yaaba.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Données de référence (régions, langues) : un code, un type et un document JSON.
 */
@Entity
@Table(name = "reference_data")
public class Reference {

    public enum Kind { REGION, LANGUAGE }

    @Id
    @Column(length = 80)
    private String id;

    @Column(nullable = false, length = 20)
    private Kind kind;

    @Column(nullable = false, length = 40)
    private String code;

    private int position;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    protected Reference() {}

    public Reference(Kind kind, String code, int position, String content) {
        this.id = kind.name() + ":" + code;
        this.kind = kind;
        this.code = code;
        this.position = position;
        this.content = content;
    }

    public String getId() { return id; }
    public Kind getKind() { return kind; }
    public String getCode() { return code; }
    public int getPosition() { return position; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}

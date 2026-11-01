package bf.yaaba.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Un conte, une légende ou un récit historique.
 * Les métadonnées utiles aux recherches sont des colonnes ; le contenu narratif
 * multilingue (scènes, illustrations, quiz, glossaire) est stocké sous forme de document JSON.
 */
@Entity
@Table(name = "tale", indexes = {@Index(columnList = "region"), @Index(columnList = "type")})
public class Tale {

    @Id
    @Column(length = 120)
    private String slug;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false, length = 40)
    private String region;

    private String place;
    private String people;

    @Column(length = 30)
    private String language;

    private double latitude;
    private double longitude;
    private int duration;
    private int age;
    private boolean featured;
    private int position;

    @Lob
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** seed = contenu éditorial, admin = saisi au tableau de bord, community = contribution validée */
    @Column(length = 12)
    private String origin = "seed";

    private boolean published = true;

    /** utilisateur à l'origine du conte (contribution) */
    private Long authorUserId;

    private long views;
    private long likes;
    private Instant createdAt = Instant.now();

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getPlace() { return place; }
    public void setPlace(String place) { this.place = place; }
    public String getPeople() { return people; }
    public void setPeople(String people) { this.people = people; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
    public int getDuration() { return duration; }
    public void setDuration(int duration) { this.duration = duration; }
    public int getAge() { return age; }
    public void setAge(int age) { this.age = age; }
    public boolean isFeatured() { return featured; }
    public void setFeatured(boolean featured) { this.featured = featured; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public long getViews() { return views; }
    public void setViews(long views) { this.views = views; }
    public long getLikes() { return likes; }
    public void setLikes(long likes) { this.likes = likes; }
    public Instant getCreatedAt() { return createdAt; }
    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public Long getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(Long authorUserId) { this.authorUserId = authorUserId; }
}

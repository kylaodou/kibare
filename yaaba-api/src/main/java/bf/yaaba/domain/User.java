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

/** Compte d'un visiteur inscrit (contributeur) ou d'un administrateur. */
@Entity
@Table(name = "app_user")
public class User {

    public enum Role { USER, ADMIN }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Role role = Role.USER;

    @Column(length = 40)
    private String region;

    @Column(length = 30)
    private String language;

    @Column(length = 400)
    private String bio;

    /** null = compte créé avant la vérification des e-mails (considéré comme vérifié) */
    private Boolean emailVerified;

    /** identifiant Google (« sub ») quand le compte est lié à Google */
    @Column(length = 64, unique = true)
    private String googleId;

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }

    /** empreinte du jeton de vérification envoyé par e-mail (jamais le jeton lui-même) */
    @Column(length = 64)
    private String verifyTokenHash;

    private Instant verifyExpiresAt;

    private boolean active = true;
    private Instant createdAt = Instant.now();
    private Instant lastLoginAt;

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    public boolean isEmailVerified() { return emailVerified == null || emailVerified; }

    /** false : compte créé avec Google, aucun mot de passe choisi (null = ancien compte, mot de passe défini) */
    private Boolean passwordSet;

    public boolean hasPassword() { return passwordSet == null || passwordSet; }
    public void setPasswordSet(Boolean passwordSet) { this.passwordSet = passwordSet; }
    public void setEmailVerified(Boolean emailVerified) { this.emailVerified = emailVerified; }
    public String getVerifyTokenHash() { return verifyTokenHash; }
    public void setVerifyTokenHash(String verifyTokenHash) { this.verifyTokenHash = verifyTokenHash; }
    public Instant getVerifyExpiresAt() { return verifyExpiresAt; }
    public void setVerifyExpiresAt(Instant verifyExpiresAt) { this.verifyExpiresAt = verifyExpiresAt; }
}

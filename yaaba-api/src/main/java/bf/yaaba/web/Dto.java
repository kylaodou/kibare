package bf.yaaba.web;

import bf.yaaba.domain.AudioTrack;
import bf.yaaba.domain.Contribution;
import bf.yaaba.domain.Notification;
import bf.yaaba.domain.User;
import bf.yaaba.service.StorageService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Objets échangés avec le front (records immuables). */
public final class Dto {

    private Dto() {}

    /* ---------------------------------------------------------- comptes */

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 80) String name,
            @NotBlank @Email @Size(max = 120) String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @Size(max = 40) String region,
            @Size(max = 30) String language) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record ProfileRequest(
            @NotBlank @Size(min = 2, max = 80) String name,
            @Size(max = 40) String region,
            @Size(max = 30) String language,
            @Size(max = 400) String bio) {}

    public record UserView(long id, String name, String email, String role, String region, String language, String bio,
                           boolean active, boolean emailVerified, boolean hasPassword, boolean google, Instant createdAt) {
        public static UserView of(User u) {
            return new UserView(u.getId(), u.getName(), u.getEmail(), u.getRole().name(), u.getRegion(), u.getLanguage(),
                    u.getBio(), u.isActive(), u.isEmailVerified(), u.hasPassword(), u.getGoogleId() != null, u.getCreatedAt());
        }
    }

    /** emailSent : à l'inscription, l'e-mail de vérification est-il parti ? (absent à la connexion) */
    public record AuthView(String token, UserView user, Boolean emailSent) {}

    /* ------------------------------------------ e-mail et mot de passe */

    /** currentPassword : exigé seulement si le compte a déjà un mot de passe */
    public record PasswordChangeRequest(@Size(max = 100) String currentPassword, @NotBlank @Size(min = 8, max = 100) String newPassword) {}

    public record GoogleRequest(@NotBlank @Size(max = 4096) String credential) {}

    public record GoogleConfigView(boolean enabled, String clientId) {}

    public record TokenRequest(@NotBlank @Size(max = 200) String token) {}

    public record ForgotRequest(@NotBlank @Email @Size(max = 120) String email) {}

    public record VerifyCodeRequest(@NotBlank @Email @Size(max = 120) String email,
                                    @NotBlank @Pattern(regexp = "[0-9]{6}", message = "Le code comporte 6 chiffres") String code) {}

    public record ResetRequest(@NotBlank @Size(max = 200) String resetToken, @NotBlank @Size(min = 8, max = 100) String password) {}

    public record MessageView(String message) {}

    public record ResetTokenView(String resetToken, long expiresInSeconds) {}

    /** Contributeur affiché publiquement (sans e-mail). */
    public record ContributorView(long id, String name, String region, String language, String bio, long approved,
                                  List<String> tales, Instant since) {}

    /* ----------------------------------------------------------- contes */

    /** Voix publiée ; sceneId = paragraphe lu (null : conte entier, ancien format). */
    public record AudioView(long id, String lang, String url, String narrator, String sceneId, List<String> segments, Instant createdAt) {
        public static AudioView of(AudioTrack t) {
            return new AudioView(t.getId(), t.getLang(), StorageService.mediaUrl(t.getFileName()), t.getNarrator(),
                    t.getSceneId(), segmentUrls(t.getSegments()), t.getCreatedAt());
        }
    }

    /** Page de résultats calculée côté serveur ; counts : compteurs annexes (onglets). */
    public record PageView<T>(List<T> items, long total, int page, int size, Map<String, Long> counts) {}

    /** Option du sélecteur de contes. */
    public record TaleOption(String slug, String title, String region) {}

    /** Vidéo téléversée. */
    public record MediaView(String url, String contentType, long size) {}

    /** « a.webm,b.webm » → URLs publiques, dans l'ordre des paragraphes. */
    static List<String> segmentUrls(String files) {
        if (files == null || files.isBlank()) return List.of();
        return java.util.Arrays.stream(files.split(",")).map(StorageService::mediaUrl).toList();
    }

    public record LikeRequest(boolean liked) {}

    public record LikeView(long likes) {}

    public record ViewRequest(String lang) {}

    /* ---------------------------------------------------- contributions */

    public record ContributionRequest(
            @NotBlank @Pattern(regexp = "voice|story") String kind,
            @Size(max = 120) String taleSlug,
            @NotBlank @Size(max = 160) String title,
            @Size(max = 40) String region,
            @NotBlank @Size(max = 30) String language,
            @Pattern(regexp = "conte|legende|recit") String taleType,
            @Size(max = 400) String summary,
            @Size(max = 300) String moral,
            @Size(max = 20000) String text,
            boolean consent) {}

    public record ReviewRequest(@Size(max = 500) String note) {}

    public record ContributionView(
            long id, String kind, String taleSlug, String publishedSlug, String title, String region, String language,
            String taleType, String summary, String moral, String text, String audioUrl, List<String> segments, String status,
            String reviewNote, Long userId, String authorName, String authorEmail, Instant createdAt, Instant reviewedAt,
            List<RecordingView> recordings) {
        public static ContributionView of(Contribution c) {
            return of(c, List.of());
        }

        public static ContributionView of(Contribution c, List<RecordingView> recordings) {
            return new ContributionView(c.getId(), c.getKind().name(), c.getTaleSlug(), c.getPublishedSlug(), c.getTitle(),
                    c.getRegion(), c.getLanguage(), c.getTaleType(), c.getSummary(), c.getMoral(), c.getText(),
                    StorageService.mediaUrl(c.getAudioFile()), segmentUrls(c.getSegmentFiles()), c.getStatus().name(),
                    c.getReviewNote(), c.getUserId(), c.getAuthorName(), c.getAuthorEmail(), c.getCreatedAt(), c.getReviewedAt(),
                    recordings);
        }
    }

    /** Enregistrement d'une contribution et le paragraphe qu'il lit. */
    public record RecordingView(String url, String sceneId, Integer paragraph, String text, String matchedBy) {}

    /* ------------------------------------------------------ commentaires */

    public record CommentRequest(@NotBlank @Size(min = 2, max = 2000) String text, Long parentId) {}

    public record CommentView(long id, String taleSlug, Long parentId, String text, String status, long userId,
                              String userName, boolean admin, Instant createdAt) {}

    /* ---------------------------------------------------- notifications */

    public record NotificationView(long id, String type, String message, String link, boolean read, Instant createdAt) {
        public static NotificationView of(Notification n) {
            return new NotificationView(n.getId(), n.getType().name(), n.getMessage(), n.getLink(), n.isRead(), n.getCreatedAt());
        }
    }

    /* -------------------------------------------------- tableau de bord */

    public record StatsView(long tales, long regions, long languages, long audioTracks, long contributions, long pending,
                            long views, long users, long comments) {}

    public record DashboardView(
            StatsView totals,
            List<Map<String, Object>> daily,
            List<Map<String, Object>> topTales,
            Map<String, Long> contributionsByStatus,
            Map<String, Long> contributionsByLanguage,
            Map<String, Long> talesByRegion,
            Map<String, Long> viewsByLanguage,
            List<ContributionView> latestContributions,
            List<CommentView> latestComments) {}

    public record ErrorView(int status, String message) {}
}

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
                           boolean active, Instant createdAt) {
        public static UserView of(User u) {
            return new UserView(u.getId(), u.getName(), u.getEmail(), u.getRole().name(), u.getRegion(), u.getLanguage(),
                    u.getBio(), u.isActive(), u.getCreatedAt());
        }
    }

    public record AuthView(String token, UserView user) {}

    /** Contributeur affiché publiquement (sans e-mail). */
    public record ContributorView(long id, String name, String region, String language, String bio, long approved,
                                  List<String> tales, Instant since) {}

    /* ----------------------------------------------------------- contes */

    public record AudioView(long id, String lang, String url, String narrator, List<String> segments) {
        public static AudioView of(AudioTrack t) {
            return new AudioView(t.getId(), t.getLang(), StorageService.mediaUrl(t.getFileName()), t.getNarrator(),
                    segmentUrls(t.getSegments()));
        }
    }

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
            String reviewNote, Long userId, String authorName, String authorEmail, Instant createdAt, Instant reviewedAt) {
        public static ContributionView of(Contribution c) {
            return new ContributionView(c.getId(), c.getKind().name(), c.getTaleSlug(), c.getPublishedSlug(), c.getTitle(),
                    c.getRegion(), c.getLanguage(), c.getTaleType(), c.getSummary(), c.getMoral(), c.getText(),
                    StorageService.mediaUrl(c.getAudioFile()), segmentUrls(c.getSegmentFiles()), c.getStatus().name(),
                    c.getReviewNote(), c.getUserId(), c.getAuthorName(), c.getAuthorEmail(), c.getCreatedAt(), c.getReviewedAt());
        }
    }

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

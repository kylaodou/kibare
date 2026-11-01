package bf.yaaba.repo;

import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.domain.AudioTrack;
import bf.yaaba.domain.Comment;
import bf.yaaba.domain.Contribution;
import bf.yaaba.domain.Notification;
import bf.yaaba.domain.Reference;
import bf.yaaba.domain.Tale;
import bf.yaaba.domain.User;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Dépôts Spring Data, regroupés car très courts. */
public final class Repositories {

    private Repositories() {}

    public interface TaleRepository extends JpaRepository<Tale, String> {
        List<Tale> findAllByOrderByPositionAsc();

        List<Tale> findByPublishedTrueOrderByPositionAsc();

        List<Tale> findByAuthorUserId(Long userId);

        @Modifying
        @Query("update Tale t set t.views = t.views + 1 where t.slug = :slug")
        int incrementViews(@Param("slug") String slug);

        @Query("select coalesce(sum(t.views), 0) from Tale t")
        long totalViews();

        @Query("select coalesce(max(t.position), 0) from Tale t")
        int maxPosition();
    }

    public interface ReferenceRepository extends JpaRepository<Reference, String> {
        List<Reference> findByKindOrderByPositionAsc(Reference.Kind kind);

        long countByKind(Reference.Kind kind);
    }

    public interface AudioTrackRepository extends JpaRepository<AudioTrack, Long> {
        List<AudioTrack> findByTaleSlugOrderByCreatedAtAsc(String taleSlug);

        List<AudioTrack> findByContributionId(Long contributionId);
    }

    public interface ContributionRepository extends JpaRepository<Contribution, Long> {
        List<Contribution> findAllByOrderByCreatedAtDesc();

        List<Contribution> findByUserIdOrderByCreatedAtDesc(Long userId);

        List<Contribution> findByStatus(Contribution.Status status);

        long countByStatus(Contribution.Status status);
    }

    public interface UserRepository extends JpaRepository<User, Long> {
        Optional<User> findByEmailIgnoreCase(String email);

        boolean existsByEmailIgnoreCase(String email);

        List<User> findByRole(User.Role role);

        List<User> findAllByOrderByCreatedAtDesc();
    }

    public interface CommentRepository extends JpaRepository<Comment, Long> {
        List<Comment> findByTaleSlugAndStatusOrderByCreatedAtAsc(String taleSlug, Comment.Status status);

        List<Comment> findAllByOrderByCreatedAtDesc();

        long countByTaleSlugAndStatus(String taleSlug, Comment.Status status);

        long countByUserId(Long userId);
    }

    public interface NotificationRepository extends JpaRepository<Notification, Long> {
        @Query("select n from Notification n where n.userId = :userId or (:admin = true and n.userId is null) order by n.createdAt desc")
        List<Notification> forUser(@Param("userId") Long userId, @Param("admin") boolean admin);
    }

    public interface ActivityRepository extends JpaRepository<ActivityEvent, Long> {
        @Query("select e.eventDay, e.kind, count(e) from ActivityEvent e where e.eventDay >= :from group by e.eventDay, e.kind order by e.eventDay")
        List<Object[]> daily(@Param("from") LocalDate from);

        @Query("select e.lang, count(e) from ActivityEvent e where e.kind = bf.yaaba.domain.ActivityEvent.Kind.VIEW and e.lang is not null group by e.lang")
        List<Object[]> viewsByLang();
    }
}

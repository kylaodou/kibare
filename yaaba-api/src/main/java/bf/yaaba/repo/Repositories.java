package bf.yaaba.repo;

import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.domain.AudioTrack;
import bf.yaaba.domain.Comment;
import bf.yaaba.domain.Contribution;
import bf.yaaba.domain.Notification;
import bf.yaaba.domain.PasswordReset;
import bf.yaaba.domain.Reference;
import bf.yaaba.domain.Tale;
import bf.yaaba.domain.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

        /** recherche paginée de l'administration : q en minuscules entouré de %, '' = tout */
        @Query("select t from Tale t where (:q = '' or lower(t.title) like :q or lower(t.slug) like :q or lower(t.region) like :q"
                + " or lower(t.people) like :q or lower(t.place) like :q) and (:origin = '' or t.origin = :origin)")
        Page<Tale> search(@Param("q") String q, @Param("origin") String origin, Pageable page);

        /** options du sélecteur de contes (publics), chargées page par page */
        @Query("select t from Tale t where t.published = true and (:q = '' or lower(t.title) like :q or lower(t.place) like :q)")
        Page<Tale> options(@Param("q") String q, Pageable page);
    }

    public interface ReferenceRepository extends JpaRepository<Reference, String> {
        List<Reference> findByKindOrderByPositionAsc(Reference.Kind kind);

        long countByKind(Reference.Kind kind);
    }

    public interface AudioTrackRepository extends JpaRepository<AudioTrack, Long> {
        List<AudioTrack> findByTaleSlugOrderByCreatedAtAsc(String taleSlug);

        List<AudioTrack> findByContributionId(Long contributionId);

        List<AudioTrack> findByTaleSlugAndSceneId(String taleSlug, String sceneId);
    }

    public interface ContributionRepository extends JpaRepository<Contribution, Long> {
        List<Contribution> findAllByOrderByCreatedAtDesc();

        List<Contribution> findByUserIdOrderByCreatedAtDesc(Long userId);

        List<Contribution> findByStatus(Contribution.Status status);

        long countByStatus(Contribution.Status status);

        @Query("select c from Contribution c where (:status is null or c.status = :status) and (:q = '' or lower(c.title) like :q"
                + " or lower(c.authorName) like :q or lower(c.authorEmail) like :q or lower(c.language) like :q)")
        Page<Contribution> search(@Param("status") Contribution.Status status, @Param("q") String q, Pageable page);
    }

    public interface UserRepository extends JpaRepository<User, Long> {
        Optional<User> findByEmailIgnoreCase(String email);

        boolean existsByEmailIgnoreCase(String email);

        List<User> findByRole(User.Role role);

        List<User> findAllByOrderByCreatedAtDesc();

        @Query("select u from User u where :q = '' or lower(u.name) like :q or lower(u.email) like :q or lower(u.region) like :q")
        Page<User> search(@Param("q") String q, Pageable page);

        Optional<User> findByVerifyTokenHash(String verifyTokenHash);

        Optional<User> findByGoogleId(String googleId);

        /** comptes créés avec Google avant l'ajout de passwordSet : aucun mot de passe connu de l'utilisateur */
        @org.springframework.data.jpa.repository.Modifying
        @Query("update User u set u.passwordSet = false where u.googleId is not null and u.passwordSet is null and u.lastLoginAt is not null"
                + " and u.createdAt >= :since")
        int markGoogleWithoutPassword(@Param("since") java.time.Instant since);
    }

    public interface CommentRepository extends JpaRepository<Comment, Long> {
        List<Comment> findByTaleSlugAndStatusOrderByCreatedAtAsc(String taleSlug, Comment.Status status);

        List<Comment> findAllByOrderByCreatedAtDesc();

        long countByTaleSlugAndStatus(String taleSlug, Comment.Status status);

        long countByUserId(Long userId);

        @Query("select c from Comment c where (:status is null or c.status = :status) and (:q = '' or lower(c.text) like :q"
                + " or lower(c.taleSlug) like :q or c.userId in (select u.id from User u where lower(u.name) like :q))")
        Page<Comment> search(@Param("status") Comment.Status status, @Param("q") String q, Pageable page);
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

    public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {
        long countByUserIdAndCreatedAtAfter(Long userId, Instant after);

        Optional<PasswordReset> findFirstByUserIdOrderByCreatedAtDesc(Long userId);

        Optional<PasswordReset> findByResetTokenHash(String resetTokenHash);
    }
}

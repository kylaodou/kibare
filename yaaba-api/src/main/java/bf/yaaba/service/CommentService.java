package bf.yaaba.service;

import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.domain.Comment;
import bf.yaaba.domain.Notification;
import bf.yaaba.domain.User;
import bf.yaaba.repo.Repositories.CommentRepository;
import bf.yaaba.repo.Repositories.UserRepository;
import bf.yaaba.web.Dto.CommentRequest;
import bf.yaaba.web.Dto.CommentView;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Commentaires des lecteurs, avec réponses et modération. */
@Service
public class CommentService {

    private final CommentRepository comments;
    private final UserRepository users;
    private final AuthService auth;
    private final TaleService tales;
    private final NotificationService notifications;
    private final ActivityService activity;

    public CommentService(CommentRepository comments, UserRepository users, AuthService auth, TaleService tales,
                          NotificationService notifications, ActivityService activity) {
        this.comments = comments;
        this.users = users;
        this.auth = auth;
        this.tales = tales;
        this.notifications = notifications;
        this.activity = activity;
    }

    @Transactional(readOnly = true)
    public List<CommentView> forTale(String slug) {
        return views(comments.findByTaleSlugAndStatusOrderByCreatedAtAsc(slug, Comment.Status.VISIBLE));
    }

    @Transactional
    public CommentView add(String slug, CommentRequest req) {
        if (!tales.exists(slug)) throw new NotFoundException("Conte introuvable");
        User u = auth.current();
        Comment parent = null;
        if (req.parentId() != null) {
            parent = comments.findById(req.parentId()).filter(c -> c.getTaleSlug().equals(slug))
                    .orElseThrow(() -> new NotFoundException("Commentaire introuvable"));
        }
        Comment c = comments.save(new Comment(slug, u.getId(), parent == null ? null : parent.getId(), req.text().strip()));
        activity.log(ActivityEvent.Kind.COMMENT, slug, null);
        String link = "/contes/" + slug + "#commentaires";
        notifications.toAdmins(Notification.Type.NEW_COMMENT, u.getName() + " a commenté « " + tales.title(slug) + " »", link);
        if (parent != null && !parent.getUserId().equals(u.getId())) {
            notifications.toUser(parent.getUserId(), Notification.Type.COMMENT_REPLY,
                    u.getName() + " a répondu à votre commentaire sur « " + tales.title(slug) + " »", link);
        }
        return views(List.of(c)).get(0);
    }

    @Transactional
    public void delete(long id) {
        Comment c = comments.findById(id).orElseThrow(() -> new NotFoundException("Commentaire introuvable"));
        if (!auth.isAdmin() && !c.getUserId().equals(auth.currentId())) throw new ForbiddenException("Action non autorisée");
        comments.delete(c);
    }

    @Transactional
    public CommentView setStatus(long id, Comment.Status status) {
        Comment c = comments.findById(id).orElseThrow(() -> new NotFoundException("Commentaire introuvable"));
        c.setStatus(status);
        return views(List.of(c)).get(0);
    }

    @Transactional(readOnly = true)
    public List<CommentView> all() {
        return views(comments.findAllByOrderByCreatedAtDesc());
    }

    List<CommentView> views(List<Comment> list) {
        Map<Long, User> byId = users.findAllById(list.stream().map(Comment::getUserId).distinct().toList()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return list.stream().map(c -> {
            User u = byId.get(c.getUserId());
            return new CommentView(c.getId(), c.getTaleSlug(), c.getParentId(), c.getText(), c.getStatus().name(),
                    c.getUserId(), u == null ? "—" : u.getName(), u != null && u.getRole() == User.Role.ADMIN, c.getCreatedAt());
        }).toList();
    }
}

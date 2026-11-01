package bf.yaaba.service;

import bf.yaaba.domain.Notification;
import bf.yaaba.repo.Repositories.NotificationRepository;
import bf.yaaba.web.Dto.NotificationView;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Notifications en base, relevées par le front (badge + liste). */
@Service
public class NotificationService {

    private final NotificationRepository repo;

    public NotificationService(NotificationRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public void toUser(Long userId, Notification.Type type, String message, String link) {
        if (userId != null) repo.save(new Notification(userId, type, message, link));
    }

    @Transactional
    public void toAdmins(Notification.Type type, String message, String link) {
        repo.save(new Notification(null, type, message, link));
    }

    @Transactional(readOnly = true)
    public List<NotificationView> list(Long userId, boolean admin) {
        return repo.forUser(userId, admin).stream().limit(60).map(NotificationView::of).toList();
    }

    @Transactional
    public void markRead(Long userId, boolean admin, Long id) {
        repo.forUser(userId, admin).stream()
                .filter(n -> id == null || n.getId().equals(id))
                .forEach(n -> n.setRead(true));
    }
}

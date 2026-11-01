package bf.yaaba.service;

import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.repo.Repositories.ActivityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Enregistre les événements d'usage alimentant les graphiques du tableau de bord. */
@Service
public class ActivityService {

    private final ActivityRepository repo;

    public ActivityService(ActivityRepository repo) {
        this.repo = repo;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(ActivityEvent.Kind kind, String taleSlug, String lang) {
        repo.save(new ActivityEvent(kind, taleSlug, lang));
    }
}

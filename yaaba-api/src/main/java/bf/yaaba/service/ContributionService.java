package bf.yaaba.service;

import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.domain.AudioTrack;
import bf.yaaba.domain.Contribution;
import bf.yaaba.domain.Notification;
import bf.yaaba.domain.User;
import bf.yaaba.repo.Repositories.AudioTrackRepository;
import bf.yaaba.repo.Repositories.ContributionRepository;
import bf.yaaba.web.Dto.ContributionRequest;
import bf.yaaba.web.Dto.ContributionView;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Cycle de vie des contributions : dépôt par un utilisateur connecté, notification aux administrateurs,
 * puis modération. Valider une « voix » publie l'enregistrement sur le conte ; valider un « récit »
 * publie un nouveau conte crédité à son auteur. L'auteur est notifié de la décision.
 */
@Service
public class ContributionService {

    private final ContributionRepository contributions;
    private final AudioTrackRepository audio;
    private final StorageService storage;
    private final TaleService tales;
    private final AuthService auth;
    private final NotificationService notifications;
    private final ActivityService activity;

    public ContributionService(ContributionRepository contributions, AudioTrackRepository audio, StorageService storage,
                               TaleService tales, AuthService auth, NotificationService notifications, ActivityService activity) {
        this.contributions = contributions;
        this.audio = audio;
        this.storage = storage;
        this.tales = tales;
        this.auth = auth;
        this.notifications = notifications;
        this.activity = activity;
    }

    @Transactional
    public ContributionView create(ContributionRequest req, MultipartFile file, List<MultipartFile> segments) {
        List<MultipartFile> parts = segments == null ? List.of() : segments.stream().filter(f -> f != null && !f.isEmpty()).toList();
        if (!req.consent()) throw new IllegalArgumentException("Le consentement est requis");
        User user = auth.current();
        Contribution.Kind kind = Contribution.Kind.valueOf(req.kind());
        if (kind == Contribution.Kind.voice) {
            if (req.taleSlug() == null || !tales.exists(req.taleSlug())) throw new IllegalArgumentException("Conte inconnu");
            if ((file == null || file.isEmpty()) && parts.isEmpty())
                throw new IllegalArgumentException("Un enregistrement est requis pour prêter sa voix");
        } else if (req.text() == null || req.text().strip().length() < 40) {
            throw new IllegalArgumentException("Le texte du conte est trop court");
        }

        Contribution c = new Contribution();
        c.setKind(kind);
        c.setUserId(user.getId());
        c.setTaleSlug(kind == Contribution.Kind.voice ? req.taleSlug() : null);
        c.setTitle(req.title().strip());
        c.setRegion(req.region());
        c.setLanguage(req.language());
        c.setTaleType(req.taleType());
        c.setSummary(blankToNull(req.summary()));
        c.setMoral(blankToNull(req.moral()));
        c.setAuthorName(user.getName());
        c.setAuthorEmail(user.getEmail());
        c.setText(blankToNull(req.text()));
        c.setConsent(true);
        if (file != null && !file.isEmpty()) {
            StorageService.Stored stored = storage.storeAudio(file);
            c.setAudioFile(stored.fileName());
            c.setAudioContentType(stored.contentType());
        }
        if (!parts.isEmpty()) {
            List<String> names = new java.util.ArrayList<>();
            for (MultipartFile part : parts) {
                StorageService.Stored stored = storage.storeAudio(part);
                names.add(stored.fileName());
                if (c.getAudioFile() == null) c.setAudioContentType(stored.contentType());
            }
            c.setSegmentFiles(String.join(",", names));
            if (c.getAudioFile() == null) c.setAudioFile(names.get(0));
        }
        contributions.save(c);
        activity.log(ActivityEvent.Kind.CONTRIBUTION, c.getTaleSlug(), c.getLanguage());
        String what = kind == Contribution.Kind.voice ? "une voix pour" : "un nouveau récit :";
        notifications.toAdmins(Notification.Type.NEW_CONTRIBUTION,
                user.getName() + " a proposé " + what + " « " + c.getTitle() + " »", "/admin/contributions");
        return ContributionView.of(c);
    }

    @Transactional(readOnly = true)
    public List<ContributionView> mine() {
        return contributions.findByUserIdOrderByCreatedAtDesc(auth.current().getId()).stream().map(ContributionView::of).toList();
    }

    @Transactional(readOnly = true)
    public List<ContributionView> list() {
        return contributions.findAllByOrderByCreatedAtDesc().stream().map(ContributionView::of).toList();
    }

    @Transactional
    public ContributionView approve(long id, String note) {
        Contribution c = find(id);
        if (c.getStatus() != Contribution.Status.APPROVED) {
            if (c.getKind() == Contribution.Kind.voice && c.getAudioFile() != null) {
                AudioTrack track = new AudioTrack(c.getTaleSlug(), c.getLanguage(), c.getAuthorName(), c.getAudioFile(), c.getAudioContentType(), c.getId());
                track.setSegments(c.getSegmentFiles());
                audio.save(track);
            }
            if (c.getKind() == Contribution.Kind.story && c.getPublishedSlug() == null) {
                c.setPublishedSlug(tales.publishFromContribution(c));
            } else if (c.getPublishedSlug() != null) {
                tales.setPublished(c.getPublishedSlug(), true);
            }
        }
        c.setStatus(Contribution.Status.APPROVED);
        c.setReviewNote(blankToNull(note));
        c.setReviewedAt(Instant.now());
        String link = c.getKind() == Contribution.Kind.voice ? "/contes/" + c.getTaleSlug()
                : c.getPublishedSlug() != null ? "/contes/" + c.getPublishedSlug() : "/compte";
        notifications.toUser(c.getUserId(), Notification.Type.CONTRIBUTION_APPROVED,
                "Bonne nouvelle ! Votre contribution « " + c.getTitle() + " » a été acceptée et publiée.", link);
        return ContributionView.of(c);
    }

    @Transactional
    public ContributionView reject(long id, String note) {
        Contribution c = find(id);
        unpublish(c);
        c.setStatus(Contribution.Status.REJECTED);
        c.setReviewNote(blankToNull(note));
        c.setReviewedAt(Instant.now());
        notifications.toUser(c.getUserId(), Notification.Type.CONTRIBUTION_REJECTED,
                "Votre contribution « " + c.getTitle() + " » n'a pas été retenue"
                        + (c.getReviewNote() != null ? " : " + c.getReviewNote() : "."), "/compte");
        return ContributionView.of(c);
    }

    @Transactional
    public void delete(long id) {
        Contribution c = find(id);
        unpublish(c);
        storage.delete(c.getAudioFile());
        if (c.getSegmentFiles() != null)
            for (String f : c.getSegmentFiles().split(",")) if (!f.equals(c.getAudioFile())) storage.delete(f);
        contributions.delete(c);
    }

    private void unpublish(Contribution c) {
        audio.findByContributionId(c.getId()).forEach(audio::delete);
        if (c.getPublishedSlug() != null) tales.setPublished(c.getPublishedSlug(), false);
    }

    private Contribution find(long id) {
        return contributions.findById(id).orElseThrow(() -> new NotFoundException("Contribution introuvable"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}

package bf.yaaba.service;

import bf.yaaba.domain.Contribution;
import bf.yaaba.domain.Tale;
import bf.yaaba.domain.User;
import bf.yaaba.repo.Repositories.ActivityRepository;
import bf.yaaba.repo.Repositories.CommentRepository;
import bf.yaaba.repo.Repositories.ContributionRepository;
import bf.yaaba.repo.Repositories.TaleRepository;
import bf.yaaba.repo.Repositories.UserRepository;
import bf.yaaba.web.Dto.ContributionView;
import bf.yaaba.web.Dto.DashboardView;
import bf.yaaba.web.Dto.UserView;
import bf.yaaba.web.Dto.PageView;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Agrégats pour le tableau de bord d'administration. */
@Service
public class DashboardService {

    private final TaleService tales;
    private final TaleRepository taleRepo;
    private final ContributionRepository contributions;
    private final CommentRepository comments;
    private final CommentService commentService;
    private final UserRepository users;
    private final ActivityRepository activity;

    public DashboardService(TaleService tales, TaleRepository taleRepo, ContributionRepository contributions,
                            CommentRepository comments, CommentService commentService, UserRepository users,
                            ActivityRepository activity) {
        this.tales = tales;
        this.taleRepo = taleRepo;
        this.contributions = contributions;
        this.comments = comments;
        this.commentService = commentService;
        this.users = users;
        this.activity = activity;
    }

    @Transactional(readOnly = true)
    public DashboardView dashboard() {
        LocalDate from = LocalDate.now().minusDays(29);
        Map<LocalDate, Map<String, Object>> days = new TreeMap<>();
        for (int i = 0; i < 30; i++) {
            LocalDate d = from.plusDays(i);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("day", d.toString());
            for (String k : List.of("VIEW", "LIKE", "COMMENT", "CONTRIBUTION", "SIGNUP")) row.put(k, 0L);
            days.put(d, row);
        }
        for (Object[] r : activity.daily(from)) {
            Map<String, Object> row = days.get((LocalDate) r[0]);
            if (row != null) row.put(r[1].toString(), r[2]);
        }

        List<Map<String, Object>> top = taleRepo.findByPublishedTrueOrderByPositionAsc().stream()
                .sorted(Comparator.comparingLong(Tale::getViews).reversed())
                .limit(8)
                .map(t -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("slug", t.getSlug());
                    m.put("title", tales.title(t.getSlug()));
                    m.put("views", t.getViews());
                    m.put("likes", t.getLikes());
                    return m;
                }).toList();

        List<Contribution> all = contributions.findAll();
        Map<String, Long> byStatus = all.stream().collect(Collectors.groupingBy(c -> c.getStatus().name(), TreeMap::new, Collectors.counting()));
        Map<String, Long> byLang = all.stream().collect(Collectors.groupingBy(Contribution::getLanguage, TreeMap::new, Collectors.counting()));
        Map<String, Long> byRegion = taleRepo.findByPublishedTrueOrderByPositionAsc().stream()
                .collect(Collectors.groupingBy(Tale::getRegion, TreeMap::new, Collectors.counting()));
        Map<String, Long> viewsByLang = new TreeMap<>();
        for (Object[] r : activity.viewsByLang()) viewsByLang.put(String.valueOf(r[0]), (Long) r[1]);

        List<ContributionView> latest = contributions.findAllByOrderByCreatedAtDesc().stream().limit(6).map(ContributionView::of).toList();
        return new DashboardView(tales.stats(), List.copyOf(days.values()), top, byStatus, byLang, byRegion, viewsByLang,
                latest, commentService.all().stream().limit(6).toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> users() {
        return users.findAllByOrderByCreatedAtDesc().stream().map(this::userRow).toList();
    }

    @Transactional(readOnly = true)
    public PageView<Map<String, Object>> usersPage(String q, int page, int size, String sortSpec) {
        Sort sort = TaleService.sort(sortSpec, Map.of("createdAt", "createdAt", "name", "name", "email", "email", "role", "role",
                "lastLoginAt", "lastLoginAt"), Sort.by(Sort.Order.desc("createdAt")));
        Page<User> p = users.search(TaleService.like(q), TaleService.pageable(page, size, sort));
        return new PageView<>(p.getContent().stream().map(this::userRow).toList(), p.getTotalElements(), p.getNumber(), p.getSize(), null);
    }

    private Map<String, Object> userRow(User u) {
        {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("user", UserView.of(u));
            m.put("contributions", contributions.findByUserIdOrderByCreatedAtDesc(u.getId()).size());
            m.put("approved", contributions.findByUserIdOrderByCreatedAtDesc(u.getId()).stream()
                    .filter(c -> c.getStatus() == Contribution.Status.APPROVED).count());
            m.put("comments", comments.countByUserId(u.getId()));
            m.put("lastLoginAt", u.getLastLoginAt());
            return m;
        }
    }

    @Transactional
    public UserView updateUser(long id, Boolean active, String role) {
        User u = users.findById(id).orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        if (active != null) u.setActive(active);
        if (role != null) u.setRole(User.Role.valueOf(role));
        return UserView.of(u);
    }
}

package bf.yaaba.service;

import bf.yaaba.config.YaabaProperties;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/** Envoi des e-mails transactionnels (vérification d'adresse, code de réinitialisation). */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    /** L'envoi a échoué : l'appelant renvoie une erreur explicite. */
    public static class MailDeliveryException extends RuntimeException {
        public MailDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private final ObjectProvider<JavaMailSender> sender;
    private final YaabaProperties props;
    private final String host;

    public MailService(ObjectProvider<JavaMailSender> sender, YaabaProperties props, @Value("${spring.mail.host:}") String host) {
        this.sender = sender;
        this.props = props;
        this.host = host == null ? "" : host.strip();
    }

    /** Un moyen d'envoi est-il disponible (SMTP ou boîte de développement) ? */
    public boolean available() {
        return brevoKey() != null || !host.isEmpty() || outbox() != null;
    }

    private String brevoKey() {
        String k = props.mail() == null ? null : props.mail().brevoApiKey();
        return k == null || k.isBlank() ? null : k.strip();
    }

    public String appUrl() {
        String url = props.mail() == null ? null : props.mail().appUrl();
        return url == null || url.isBlank() ? "http://localhost:4200" : url.replaceAll("/+$", "");
    }

    /** Envoie un e-mail aux couleurs de KIBARE. */
    public void send(String to, String subject, String title, java.util.List<String> paragraphs, String highlight, String[] button) {
        String html = layout(title, paragraphs, highlight, button);
        String text = String.join("\n\n", paragraphs) + (highlight == null ? "" : "\n\n" + highlight)
                + (button == null ? "" : "\n\n" + button[1]);
        if (brevoKey() != null) {
            sendWithBrevo(to, subject, html, text);
            return;
        }
        if (!host.isEmpty()) {
            JavaMailSender mail = sender.getIfAvailable();
            if (mail == null) throw new MailDeliveryException("Service d'e-mail indisponible", null);
            try {
                MimeMessage m = mail.createMimeMessage();
                MimeMessageHelper h = new MimeMessageHelper(m, true, StandardCharsets.UTF_8.name());
                h.setFrom(from());
                h.setTo(to);
                h.setSubject(subject);
                h.setText(text, html);
                // images intégrées au message (cid:) : visibles sans serveur public
                h.addInline("kibare-header", new ClassPathResource("mail/header.png"), "image/png");
                h.addInline("kibare-footer", new ClassPathResource("mail/footer.png"), "image/png");
                mail.send(m);
                log.info("E-mail « {} » envoyé", subject);
                return;
            } catch (Exception e) {
                log.warn("Échec d'envoi de l'e-mail « {} » : {}", subject, e.getClass().getSimpleName());
                throw new MailDeliveryException("L'e-mail n'a pas pu être envoyé. Réessayez plus tard.", e);
            }
        }
        Path dir = outbox();
        if (dir == null) throw new MailDeliveryException("Aucun service d'e-mail n'est configuré sur le serveur.", null);
        try {
            Files.createDirectories(dir);
            String name = Instant.now().toString().replace(':', '-') + "-" + UUID.randomUUID().toString().substring(0, 8) + ".html";
            // boîte de développement : images incorporées en data URI pour un aperçu fidèle
            String preview = html.replace("cid:kibare-header", dataUri("mail/header.png")).replace("cid:kibare-footer", dataUri("mail/footer.png"));
            String doc = "<!-- À : " + HtmlUtils.htmlEscape(to) + " | Objet : " + HtmlUtils.htmlEscape(subject) + " -->\n" + preview;
            Files.writeString(dir.resolve(name), doc, StandardCharsets.UTF_8);
            log.info("E-mail « {} » déposé dans la boîte de développement ({})", subject, dir);
        } catch (IOException e) {
            throw new MailDeliveryException("L'e-mail n'a pas pu être enregistré.", e);
        }
    }

    /** Envoi par l'API HTTPS de Brevo (hébergeurs qui bloquent SMTP). */
    private void sendWithBrevo(String to, String subject, String html, String text) {
        String body = html.replace("cid:kibare-header", appUrl() + "/mail/header.png")
                .replace("cid:kibare-footer", appUrl() + "/mail/footer.png");
        String from = from();
        String name = "KIBARE";
        String email = from;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^\\s*(.*?)\\s*<([^>]+)>\\s*$").matcher(from);
        if (m.matches()) {
            name = m.group(1).replace("\"", "");
            email = m.group(2);
        }
        var json = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
        json.putObject("sender").put("name", name).put("email", email);
        json.putArray("to").addObject().put("email", to);
        json.put("subject", subject).put("htmlContent", body).put("textContent", text);
        try {
            var req = java.net.http.HttpRequest.newBuilder(java.net.URI.create("https://api.brevo.com/v3/smtp/email"))
                    .timeout(java.time.Duration.ofSeconds(20))
                    .header("api-key", brevoKey())
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(json.toString(), StandardCharsets.UTF_8))
                    .build();
            var res = java.net.http.HttpClient.newHttpClient().send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                log.warn("Échec d'envoi de l'e-mail « {} » par Brevo : statut {}", subject, res.statusCode());
                throw new MailDeliveryException("L'e-mail n'a pas pu être envoyé. Réessayez plus tard.", null);
            }
            log.info("E-mail « {} » envoyé (Brevo)", subject);
        } catch (java.io.IOException e) {
            log.warn("Échec d'envoi de l'e-mail « {} » par Brevo : {}", subject, e.getClass().getSimpleName());
            throw new MailDeliveryException("L'e-mail n'a pas pu être envoyé. Réessayez plus tard.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MailDeliveryException("L'e-mail n'a pas pu être envoyé.", e);
        }
    }

    private static String dataUri(String resource) {
        try (var in = new ClassPathResource(resource).getInputStream()) {
            return "data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(in.readAllBytes());
        } catch (IOException e) {
            return "";
        }
    }

    private String from() {
        String f = props.mail() == null ? null : props.mail().from();
        return f == null || f.isBlank() ? "KIBARE <no-reply@kibare.bf>" : f;
    }

    private Path outbox() {
        String d = props.mail() == null ? null : props.mail().outboxDir();
        return d == null || d.isBlank() ? null : Path.of(d).toAbsolutePath().normalize();
    }

    /** Gabarit HTML aux couleurs de KIBARE : carte blanche à bordure simple (comme les cartes du site), en-tête avec le logo sur motifs bogolan, bandeau brun à motifs africains en pied. */
    private String layout(String title, java.util.List<String> paragraphs, String highlight, String[] button) {
        StringBuilder body = new StringBuilder();
        for (String p : paragraphs) {
            body.append("<p style=\"margin:0 0 14px;font-size:15px;line-height:1.65;color:#3d2f25\">")
                    .append(HtmlUtils.htmlEscape(p)).append("</p>");
        }
        if (highlight != null) {
            body.append("<table role=\"presentation\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px auto\"><tr>")
                    .append("<td style=\"padding:16px 30px;border-radius:12px;background:#fdf1e3;border:1px dashed #e69135;color:#7c3109;")
                    .append("font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:800;letter-spacing:10px;text-align:center\">")
                    .append(HtmlUtils.htmlEscape(highlight)).append("</td></tr></table>");
        }
        if (button != null) {
            body.append("<table role=\"presentation\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px auto\"><tr>")
                    .append("<td style=\"border-radius:8px;background:#7c3109\"><a href=\"").append(HtmlUtils.htmlEscape(button[1]))
                    .append("\" style=\"display:inline-block;padding:14px 28px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;")
                    .append("font-size:15px;font-weight:700;text-decoration:none\">").append(HtmlUtils.htmlEscape(button[0]))
                    .append("</a></td></tr></table>")
                    .append("<p style=\"margin:0 0 14px;font-size:12px;line-height:1.5;color:#8a7868;word-break:break-all\">")
                    .append("Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : ").append(HtmlUtils.htmlEscape(button[1])).append("</p>");
        }
        return "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"x-apple-disable-message-reformatting\"><style>body,table,td,p,a,h1{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;text-size-adjust:100%}</style></head>"
                + "<body style=\"margin:0;padding:0;background:#f6f1ea;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f6f1ea;padding:20px 10px\"><tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"width:100%;max-width:560px;background:#ffffff;border:1px solid #ebe1d6;border-radius:14px;overflow:hidden\">"
                + "<tr><td style=\"padding:0\"><img src=\"cid:kibare-header\" width=\"560\" alt=\"KIBARE — Le Burkina Faso à travers ses histoires\" "
                + "style=\"display:block;width:100%;max-width:560px;height:auto;border:0\"></td></tr>"
                + "<tr><td style=\"padding:8px 28px 10px\"><h1 style=\"margin:0 0 18px;font-size:21px;line-height:1.3;color:#1e1611;text-align:center\">"
                + HtmlUtils.htmlEscape(title) + "</h1>" + body + "</td></tr>"
                + "<tr><td style=\"padding:6px 28px 24px;font-size:12px;line-height:1.5;color:#8a7868;text-align:center\">"
                + "Vous recevez ce message car une action a été demandée sur KIBARE avec cette adresse. Si ce n'était pas vous, ignorez-le."
                + "</td></tr>"
                + "<tr><td style=\"padding:0\"><img src=\"cid:kibare-footer\" width=\"560\" alt=\"\" "
                + "style=\"display:block;width:100%;max-width:560px;height:auto;border:0\"></td></tr>"
                + "</table>"
                + "<p style=\"margin:16px 0 0;font-size:12px;color:#8a7868\">KIBARE · Contes et légendes du Burkina Faso</p>"
                + "</td></tr></table></body></html>";
    }
}

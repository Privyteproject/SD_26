import { useState, useEffect } from "react";
import { Check, Rocket } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { ONBOARDING_WEEKS, ONBOARDING_CONTACTS } from "../../../mock/mockData";
import { getOnboardingTasks, getOnboardingContacts } from "../../../app/api/services";

export default function Onboarding() {
  const { t, lang } = useI18n();

  const [tasksData, setTasksData] = useState(ONBOARDING_WEEKS);
  const [contactsData, setContactsData] = useState(ONBOARDING_CONTACTS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOnboardingTasks(), getOnboardingContacts()])
      .then(([resTasks, resContacts]) => {
        if (!cancelled) {
          if (resTasks.data) setTasksData(resTasks.data);
          if (resContacts.data) setContactsData(resContacts.data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  const all = tasksData.flatMap((w) => w.tasks);
  const done = all.filter((x) => x.done).length;
  const progress = Math.round((done / (all.length || 1)) * 100);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("onb.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px" }}>{t("onb.sub")}</p>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginBottom: 14 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}

      <Card style={{ display: "flex", alignItems: "center", gap: 16, borderColor: "var(--gold-soft)" }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Rocket size={20} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("onb.progress")}</div>
          <div style={{ height: 8, background: "var(--gold-tint)", borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--gold)" }} />
          </div>
        </div>
        <Badge tone="gold">{progress}%</Badge>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tasksData.map((w) => (
            <Card key={w.week}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--gold-deep)", marginBottom: 12 }}>{t("onb.week")} {w.week}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {w.tasks.map((tk) => (
                  <div key={tk.id} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14, color: tk.done ? "var(--muted)" : "var(--ink)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1px solid ${tk.done ? "var(--gold)" : "var(--line)"}`, background: tk.done ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {tk.done && <Check size={13} color="var(--on-gold)" strokeWidth={3} />}
                    </span>
                    <span style={{ textDecoration: tk.done ? "line-through" : "none" }}>{typeof tk.label === 'string' ? tk.label : tk.label[lang]}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card style={{ alignSelf: "flex-start" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("onb.contacts")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {contactsData.map((cont) => (
              <div key={cont.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>{cont.name.charAt(0)}</div>
                <div>
                  <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{cont.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{typeof cont.role === 'string' ? cont.role : cont.role[lang]}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

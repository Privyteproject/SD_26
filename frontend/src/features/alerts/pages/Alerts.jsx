import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { SEC_ALERTS } from "../../../mock/mockData";
import { getSecurityAlerts } from "../../../app/api/services";

const sevTone = { crit: "danger", high: "danger", med: "warning", low: "info" };
const sevKey = { crit: "al.crit", high: "al.high", med: "al.med", low: "al.low" };
const stTone = { open: "danger", progress: "warning", resolved: "success" };
const stKey = { open: "al.open", progress: "al.progress", resolved: "al.resolved" };

export default function Alerts() {
  const { t, lang } = useI18n();

  const [alertsData, setAlertsData] = useState(SEC_ALERTS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getSecurityAlerts()
      .then((res) => {
        if (!cancelled && res.data) setAlertsData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("al.title")}</h1>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginBottom: 14 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {alertsData.map((a) => (
          <Card key={a.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertTriangle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--ink)" }}>{typeof a.title === 'string' ? a.title : a.title[lang]}</div>
            </div>
            <Badge tone={sevTone[a.severity]}>{t(sevKey[a.severity])}</Badge>
            <Badge tone={stTone[a.status]}>{t(stKey[a.status])}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

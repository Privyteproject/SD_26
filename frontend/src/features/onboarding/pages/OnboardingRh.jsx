import { useI18n } from "../../../app/providers/I18nProvider";
import ParcoursManager from "../../../components/ParcoursManager";

// Suivi RH des intégrations : nouveaux arrivants (status NEW) + tâches d'onboarding éditables.
export default function OnboardingRh() {
  const { t } = useI18n();
  return (
    <ParcoursManager
      type="ONBOARDING"
      statusFilter="NEW"
      title={t("onbrh.title")}
      emptyLabel={t("parc.emptyNew")}
    />
  );
}

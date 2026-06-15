import { useI18n } from "../../../app/providers/I18nProvider";
import ParcoursManager from "../../../components/ParcoursManager";

// Suivi RH des départs : collaborateurs en départ (status LEAVING) + checklist d'offboarding éditable.
export default function Offboarding() {
  const { t } = useI18n();
  return (
    <ParcoursManager
      type="OFFBOARDING"
      statusFilter="LEAVING"
      title={t("offb.title")}
      emptyLabel={t("parc.emptyLeaving")}
    />
  );
}

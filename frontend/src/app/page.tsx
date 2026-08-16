import MarketingLanding from "./components/marketing/MarketingLanding";
import SmartPRIntake from "./SmartPRIntake";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SmartPRHome({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const showIntake = params.entry === "new-business" || params.resume !== undefined || params.debug !== undefined;
  return showIntake ? <SmartPRIntake /> : <MarketingLanding />;
}

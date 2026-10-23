import "./admin.css";

export const dynamic = "force-dynamic";

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="adm-root">{children}</div>;
}

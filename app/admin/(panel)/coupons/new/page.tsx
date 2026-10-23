import Coupon from "../[id]/page";
import type { SP } from "@/components/admin/ui";

export const metadata = { title: "新增優惠券" };

export default function NewCoupon({ searchParams }: { searchParams: Promise<SP> }) {
  return <Coupon params={Promise.resolve({ id: "new" })} searchParams={searchParams} />;
}

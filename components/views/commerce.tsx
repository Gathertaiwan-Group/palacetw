import Link from "next/link";
import Shell, { PageHeader, ContentWrap } from "../Shell";
import { type Post, type SiteIndex } from "@/lib/data";
import { viewCart } from "@/lib/cart";
import { currentUser, customerFor } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { money } from "@/lib/site";
import CartPage from "../CartPage";
import CheckoutForm from "../CheckoutForm";
import { LoginRegister, LostPassword, LogoutLink, EditAccount } from "../AccountForms";
import { pageBody, PAGE_LAYOUT, Sidebars } from "./content";
import { LAYOUT } from "../Shell";

function Frame({ page, extraBody, title, children, crumbTitle }: { page: Post; extraBody: string; title?: string; crumbTitle?: string; children: React.ReactNode }) {
  const layout = PAGE_LAYOUT[page.id] || LAYOUT.fullWidth;
  return (
    <Shell bodyClass={pageBody(page, "", extraBody)} header={<PageHeader title={title || page.title} crumbs={[{ label: crumbTitle || title || page.title }]} />}>
      <ContentWrap sidebars={<Sidebars layout={layout} />}>
        <article className="single-page-article clr">
          <div className="entry clr" itemProp="text">{children}</div>
        </article>
      </ContentWrap>
    </Shell>
  );
}

export async function CartView({ page }: { page: Post }) {
  const cart = await viewCart();
  return (
    <Frame page={page} extraBody="woocommerce-cart woocommerce-page">
      <CartPage initial={cart} checkoutHref="/checkout-2/" />
    </Frame>
  );
}

const STATUS_LABEL: Record<string, string> = { pending: "Pending payment", processing: "Processing", "on-hold": "On hold", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded", failed: "Failed" };

export async function CheckoutView({ ix, page, cartPage }: { ix: SiteIndex; page: Post; cartPage: Post | null }) {
  const cart = await viewCart();
  if (!cart.items.length) {
    // WooCommerce sends an empty checkout back to the cart (page 1037); the legacy /checkout/ page renders empty.
    if (page.id === 1037 && cartPage) return <CartView page={cartPage} />;
    return (
      <Frame page={page} extraBody="woocommerce-checkout woocommerce-page">
        <div className="woocommerce"><div className="woocommerce-notices-wrapper" /></div>
      </Frame>
    );
  }
  const user = await currentUser();
  const cust = user ? await customerFor(user, false) : null;
  const b = (cust?.billing || {}) as Record<string, string>;
  const defaults: Record<string, string> = {};
  for (const [k, v] of Object.entries(b)) defaults[`billing_${k}`] = String(v || "");
  if (user?.email && !defaults.billing_email) defaults.billing_email = user.email;
  return (
    <Frame page={page} extraBody="woocommerce-checkout woocommerce-page">
      <CheckoutForm cart={cart} loggedIn={!!user} defaults={defaults} />
    </Frame>
  );
}

export async function OrderReceived({ page, orderId, orderKey }: { page: Post; orderId: number; orderKey: string }) {
  const { data: order } = await admin().from("orders").select("*").eq("id", orderId).maybeSingle();
  const valid = order && order.order_key === orderKey;
  const items = valid ? (await admin().from("order_items").select("*").eq("order_id", orderId).order("id")).data || [] : [];
  return (
    <Frame page={page} extraBody="woocommerce-checkout woocommerce-page woocommerce-order-received" title="Order received">
      <div className="woocommerce">
        {!valid ? <p className="woocommerce-error">Sorry, this order is invalid and cannot be paid for.</p> : (
          <div className="woocommerce-order">
            <p className="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received">Thank you. Your order has been received.</p>
            <ul className="woocommerce-order-overview woocommerce-thankyou-order-details order_details">
              <li className="woocommerce-order-overview__order order">Order number: <strong>{order.order_number || order.id}</strong></li>
              <li className="woocommerce-order-overview__date date">Date: <strong>{new Date(order.date_created).toLocaleDateString("zh-TW")}</strong></li>
              <li className="woocommerce-order-overview__email email">Email: <strong>{order.billing?.email}</strong></li>
              <li className="woocommerce-order-overview__total total">Total: <strong>{money(order.total)}</strong></li>
              <li className="woocommerce-order-overview__payment-method method">Payment method: <strong>{order.payment_method_title}</strong></li>
              <li className="woocommerce-order-overview__status">Status: <strong>{STATUS_LABEL[order.status] || order.status}</strong></li>
            </ul>
            <OrderDetails order={order} items={items} />
          </div>
        )}
      </div>
    </Frame>
  );
}

function OrderDetails({ order, items }: { order: any; items: any[] }) {
  const lines = items.filter((i) => i.item_type === "line_item");
  const coupons = items.filter((i) => i.item_type === "coupon");
  const sub = lines.reduce((s, i) => s + Number(i.total), 0);
  return (
    <>
      <section className="woocommerce-order-details">
        <h2 className="woocommerce-order-details__title">Order details</h2>
        <table className="woocommerce-table woocommerce-table--order-details shop_table order_details">
          <thead><tr><th className="woocommerce-table__product-name product-name">Product</th><th className="woocommerce-table__product-table product-total">Total</th></tr></thead>
          <tbody>{lines.map((i) => <tr key={i.id} className="woocommerce-table__line-item order_item"><td className="woocommerce-table__product-name product-name">{i.name} <strong className="product-quantity">&times;&nbsp;{i.quantity}</strong></td><td className="woocommerce-table__product-total product-total">{money(i.total)}</td></tr>)}</tbody>
          <tfoot>
            <tr><th scope="row">Subtotal:</th><td>{money(sub)}</td></tr>
            {coupons.map((c) => <tr key={c.id}><th scope="row">Discount ({c.name}):</th><td>-{money(Math.abs(Number(c.total)))}</td></tr>)}
            <tr><th scope="row">Payment method:</th><td>{order.payment_method_title}</td></tr>
            <tr><th scope="row">Total:</th><td>{money(order.total)}</td></tr>
            {order.customer_note ? <tr><th>Note:</th><td>{order.customer_note}</td></tr> : null}
          </tfoot>
        </table>
      </section>
      <section className="woocommerce-customer-details">
        <h2 className="woocommerce-column__title">Billing address</h2>
        <address>
          {[`${order.billing?.last_name || ""}${order.billing?.first_name || ""}`, order.billing?.company, order.billing?.address_1, order.billing?.address_2, `${order.billing?.postcode || ""} ${order.billing?.city || ""} ${order.billing?.state || ""}`, order.billing?.country].filter((x) => x && String(x).trim()).map((x, k) => <span key={k}>{x}<br /></span>)}
          {order.billing?.phone ? <p className="woocommerce-customer-details--phone">{order.billing.phone}</p> : null}
          {order.billing?.email ? <p className="woocommerce-customer-details--email">{order.billing.email}</p> : null}
        </address>
      </section>
    </>
  );
}

export async function AccountView({ page, sub, arg, register = false }: { page: Post; sub: string; arg?: string; register?: boolean }) {
  const base = `/${page.slug}/`;
  const user = await currentUser();
  if (!user) {
    if (sub === "lost-password") return <Frame page={page} extraBody="woocommerce-account woocommerce-page woocommerce-lost-password" title="Lost password"><LostPassword /></Frame>;
    return <Frame page={page} extraBody="woocommerce-account woocommerce-page"><LoginRegister base={base} initialMode={register ? "register" : "login"} /></Frame>;
  }
  const cust = await customerFor(user);
  const sb = admin();
  let orders: any[] = [];
  if (cust) orders = (await sb.from("orders").select("id,order_number,status,total,date_created,order_key").eq("customer_id", cust.id).order("date_created", { ascending: false })).data || [];
  const name = cust?.display_name || user.email;
  const nav = [["dashboard", "Dashboard", base], ["orders", "Orders", `${base}orders/`], ["edit-account", "Account details", `${base}edit-account/`]];
  let content: React.ReactNode;
  let title = page.title;
  if (sub === "orders") {
    title = "Orders";
    content = orders.length ? (
      <table className="woocommerce-orders-table woocommerce-MyAccount-orders shop_table shop_table_responsive my_account_orders account-orders-table">
        <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead>
        <tbody>{orders.map((o) => (
          <tr key={o.id} className={`woocommerce-orders-table__row woocommerce-orders-table__row--status-${o.status} order`}>
            <td data-title="Order"><Link href={`${base}view-order/${o.id}/`}>#{o.order_number || o.id}</Link></td>
            <td data-title="Date"><time dateTime={o.date_created}>{new Date(o.date_created).toLocaleDateString("zh-TW")}</time></td>
            <td data-title="Status">{STATUS_LABEL[o.status] || o.status}</td>
            <td data-title="Total">{money(o.total)}</td>
            <td data-title="Actions"><Link href={`${base}view-order/${o.id}/`} className="woocommerce-button button view">View</Link></td>
          </tr>
        ))}</tbody>
      </table>
    ) : (
      <div className="woocommerce-message woocommerce-message--info woocommerce-Message woocommerce-Message--info woocommerce-info"><Link className="woocommerce-Button button" href="/shop-2/">Browse products</Link>No order has been made yet.</div>
    );
  } else if (sub === "view-order" && arg) {
    const o = orders.find((x) => String(x.id) === arg);
    if (!o) content = <div className="woocommerce-error">Invalid order.</div>;
    else {
      const { data: full } = await sb.from("orders").select("*").eq("id", o.id).single();
      const items = (await sb.from("order_items").select("*").eq("order_id", o.id).order("id")).data || [];
      title = `Order #${o.order_number || o.id}`;
      content = <><p>Order #<mark className="order-number">{o.order_number || o.id}</mark> was placed on <mark className="order-date">{new Date(o.date_created).toLocaleDateString("zh-TW")}</mark> and is currently <mark className="order-status">{STATUS_LABEL[o.status] || o.status}</mark>.</p><OrderDetails order={full} items={items} /></>;
    }
  } else if (sub === "edit-account") {
    title = "Account details";
    content = <EditAccount email={user.email || ""} />;
  } else {
    content = (
      <>
        <p>Hello <strong>{name}</strong> (not <strong>{name}</strong>? <LogoutLink>Log out</LogoutLink>)</p>
        <p>From your account dashboard you can view your <Link href={`${base}orders/`}>recent orders</Link>, and <Link href={`${base}edit-account/`}>edit your password and account details</Link>.</p>
      </>
    );
  }
  return (
    <Frame page={page} extraBody="woocommerce-account woocommerce-page logged-in" title={title}>
      <div className="woocommerce">
        <nav className="woocommerce-MyAccount-navigation" aria-label="Account pages">
          <ul>
            {nav.map(([k, l, h]) => <li key={k} className={`woocommerce-MyAccount-navigation-link woocommerce-MyAccount-navigation-link--${k}${(sub || "dashboard") === k || (k === "orders" && sub === "view-order") ? " is-active" : ""}`}><Link href={h}>{l}</Link></li>)}
            <li className="woocommerce-MyAccount-navigation-link woocommerce-MyAccount-navigation-link--customer-logout"><LogoutLink>Log out</LogoutLink></li>
          </ul>
        </nav>
        <div className="woocommerce-MyAccount-content"><div className="woocommerce-notices-wrapper" />{content}</div>
      </div>
    </Frame>
  );
}

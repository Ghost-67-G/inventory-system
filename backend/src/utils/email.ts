import { Resend } from 'resend';
import { config } from '../config';
import { logger } from './logger';

let resendClient: Resend | null = null;

if (config.RESEND_API_KEY) {
  resendClient = new Resend(config.RESEND_API_KEY);
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string): Promise<void> {
  if (!resendClient) {
    if (config.NODE_ENV === 'development') {
      logger.info('email_dev_fallback', { to, subject, html });
      return;
    }
    logger.warn('email_skip_no_api_key', { to, subject });
    return;
  }

  const result = await resendClient.emails.send({
    from: config.EMAIL_FROM,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {})
  });

  if (result.error) {
    logger.error('email_send_failed', { to, subject, error: result.error });
  }
}

interface POEmailLineItem {
  productName: string;
  productSku: string;
  orderedQty: number;
  unitCost: number;
  totalCost: number;
}

interface POEmailData {
  tenantName: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  notes?: string;
  lineItems: POEmailLineItem[];
}

export async function sendPurchaseOrderEmail(
  supplierEmail: string,
  ownerEmail: string,
  data: POEmailData
): Promise<void> {
  const subject = `Purchase Order ${data.poNumber} from ${data.tenantName}`;

  const rows = data.lineItems
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;">${item.productName}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${item.productSku}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${item.orderedQty}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${formatCurrency(item.unitCost, data.currency)}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${formatCurrency(item.totalCost, data.currency)}</td>
        </tr>
      `
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;color:#0f172a;">
      <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <h2 style="margin:0 0 8px;">Purchase Order ${data.poNumber}</h2>
          <p style="margin:0;color:#475569;">From ${data.tenantName} to ${data.supplierName}</p>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 8px;"><strong>Order date:</strong> ${data.orderDate}</p>
          <p style="margin:0 0 8px;"><strong>Expected delivery:</strong> ${data.expectedDeliveryDate ?? 'Not set'}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Product</th>
                <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">SKU</th>
                <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Qty</th>
                <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Unit Cost</th>
                <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:4px 0;"><strong>Subtotal:</strong> ${formatCurrency(data.subtotal, data.currency)}</p>
          <p style="margin:4px 0;"><strong>Tax (${data.taxRate}%):</strong> ${formatCurrency(data.taxAmount, data.currency)}</p>
          <p style="margin:4px 0;"><strong>Shipping:</strong> ${formatCurrency(data.shippingCost, data.currency)}</p>
          <p style="margin:8px 0 0;font-size:16px;"><strong>Total:</strong> ${formatCurrency(data.totalAmount, data.currency)}</p>
          ${data.notes ? `<p style="margin:16px 0 0;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
          <p style="margin:16px 0 0;color:#334155;">Please confirm receipt of this order and expected dispatch schedule.</p>
        </div>
      </div>
    </div>
  `;

  await Promise.allSettled([
    sendEmail(supplierEmail, subject, html, ownerEmail),
    sendEmail(ownerEmail, `[Copy] ${subject}`, html)
  ]);
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${config.FRONTEND_URL}/verify-email?token=${token}`;
  const html = `
    <p>Hi ${name},</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in <strong>24 hours</strong>.</p>
    <p>If you did not create an account, you can safely ignore this email.</p>
  `;
  await sendEmail(to, 'Verify your email address', html);
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${config.FRONTEND_URL}/reset-password?token=${token}`;
  const html = `
    <p>Hi ${name},</p>
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in <strong>1 hour</strong>.</p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;
  await sendEmail(to, 'Reset your password', html);
}

export async function sendWelcomeEmail(to: string, name: string, tenantName: string): Promise<void> {
  const html = `
    <p>Hi ${name},</p>
    <p>Welcome to <strong>${tenantName}</strong>! Your email has been verified and your account is ready.</p>
    <p>You can now log in and start managing your inventory.</p>
  `;
  await sendEmail(to, `Welcome to ${tenantName}!`, html);
}

interface InviteEmailData {
  inviteeName: string;
  inviterName: string;
  tenantName: string;
  temporaryPassword: string;
  acceptInviteUrl: string;
}

export async function sendInviteEmail(to: string, data: InviteEmailData): Promise<void> {
  const html = `
    <p>Hi ${data.inviteeName},</p>
    <p><strong>${data.inviterName}</strong> invited you to join <strong>${data.tenantName}</strong>.</p>
    <p>Your temporary password is:</p>
    <p style="font-size: 16px;"><strong>${data.temporaryPassword}</strong></p>
    <p>Accept your invitation and set your real password using this secure link:</p>
    <p><a href="${data.acceptInviteUrl}">${data.acceptInviteUrl}</a></p>
    <p>This invitation link expires in <strong>24 hours</strong>.</p>
  `;

  await sendEmail(to, `You've been invited to join ${data.tenantName}`, html);
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

interface LowStockEmailData {
  ownerName: string;
  productName: string;
  sku: string;
  currentStock: number;
  threshold: number;
  unit: string;
  warehouseName: string;
  currency: string;
  appUrl: string;
}

export async function sendLowStockAlertEmail(to: string, data: LowStockEmailData): Promise<void> {
  const subject = `⚠️ Low stock: ${data.productName} (${data.currentStock} ${data.unit} remaining)`;
  const html = `
    <div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <h2 style="margin:0;font-size:20px;">Inventory System</h2>
          <div style="margin-top:12px;background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:6px;font-weight:600;">Low Stock Alert</div>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 12px;">Hi ${data.ownerName},</p>
          <p style="margin:0 0 16px;color:#334155;">A product is below its configured stock threshold and needs attention.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#64748b;width:45%;">Product</td><td style="padding:8px 0;font-weight:600;">${data.productName}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">SKU</td><td style="padding:8px 0;">${data.sku}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Warehouse</td><td style="padding:8px 0;">${data.warehouseName}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Current stock</td><td style="padding:8px 0;color:#dc2626;font-weight:700;">${data.currentStock} ${data.unit}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Alert threshold</td><td style="padding:8px 0;">${data.threshold} ${data.unit}</td></tr>
          </table>
          <div style="margin-top:20px;">
            <a href="${data.appUrl}/alerts" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">View Alerts</a>
          </div>
        </div>
        <div style="padding:14px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
          You're receiving this because low stock alerts are enabled. Manage preferences in Settings.
        </div>
      </div>
    </div>
  `;

  await sendEmail(to, subject, html);
}

interface DailySummaryItem {
  name: string;
  sku: string;
  totalStock: number;
  unit: string;
  threshold: number;
}

interface DailySummaryEmailData {
  ownerName: string;
  date: string;
  pendingAlerts: number;
  movementsToday: number;
  totalStockValue: number;
  currency: string;
  topLowStock: DailySummaryItem[];
  appUrl: string;
}

export async function sendDailySummaryEmail(to: string, data: DailySummaryEmailData): Promise<void> {
  const subject = `📦 Daily inventory summary — ${data.date}`;
  const pendingColor = data.pendingAlerts > 0 ? '#dc2626' : '#16a34a';
  const lowStockTable =
    data.topLowStock.length > 0
      ? `
      <h3 style="margin:20px 0 8px;font-size:15px;">Products needing attention:</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Name</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Stock</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Threshold</th>
          </tr>
        </thead>
        <tbody>
          ${data.topLowStock
            .slice(0, 10)
            .map(
              (item) =>
                `<tr>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${item.name} (${item.sku})</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${item.totalStock} ${item.unit}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${item.threshold} ${item.unit}</td>
                </tr>`
            )
            .join('')}
        </tbody>
      </table>
      `
      : '';

  const html = `
    <div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <h2 style="margin:0;font-size:20px;">Daily Inventory Summary</h2>
          <p style="margin:6px 0 0;color:#64748b;">${data.date}</p>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 14px;">Hi ${data.ownerName},</p>
          <div style="font-size:0;">
            <div style="display:inline-block;width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-right:2%;margin-bottom:10px;">
              <div style="font-size:12px;color:#64748b;">Pending alerts</div>
              <div style="font-size:20px;font-weight:700;color:${pendingColor};">${data.pendingAlerts}</div>
            </div>
            <div style="display:inline-block;width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:10px;">
              <div style="font-size:12px;color:#64748b;">Movements today</div>
              <div style="font-size:20px;font-weight:700;">${data.movementsToday}</div>
            </div>
            <div style="display:inline-block;width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-right:2%;">
              <div style="font-size:12px;color:#64748b;">Total stock value</div>
              <div style="font-size:20px;font-weight:700;">${formatCurrency(data.totalStockValue, data.currency)}</div>
            </div>
            <div style="display:inline-block;width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
              <div style="font-size:12px;color:#64748b;">Status</div>
              <div style="font-size:20px;font-weight:700;">Healthy</div>
            </div>
          </div>
          ${lowStockTable}
          <div style="margin-top:20px;">
            <a href="${data.appUrl}/dashboard" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">Open Dashboard</a>
          </div>
        </div>
        <div style="padding:14px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
          You can disable daily summaries anytime in Settings.
        </div>
      </div>
    </div>
  `;

  await sendEmail(to, subject, html);
}

interface ImportCompletionEmailData {
  userName: string;
  fileName: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  successCount: number;
  errorCount: number;
  totalRows: number;
  appUrl: string;
}

export async function sendImportCompletionEmail(to: string, data: ImportCompletionEmailData): Promise<void> {
  const subject =
    data.status === 'COMPLETED'
      ? `Import complete — ${data.successCount} products added`
      : data.status === 'PARTIAL'
        ? `Import finished with errors — ${data.successCount} added, ${data.errorCount} failed`
        : `Import failed — ${data.fileName}`;

  const statusColor = data.status === 'COMPLETED' ? '#16a34a' : data.status === 'PARTIAL' ? '#d97706' : '#dc2626';
  const statusTitle =
    data.status === 'COMPLETED'
      ? 'Import Successful'
      : data.status === 'PARTIAL'
        ? 'Import Finished With Errors'
        : 'Import Failed';

  const html = `
    <div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="padding:14px 24px;background:${statusColor};color:#ffffff;font-weight:700;">${statusTitle}</div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 12px;">Hi ${data.userName},</p>
          <p style="margin:0 0 16px;color:#334155;">Your import file <strong>${data.fileName}</strong> has finished processing.</p>
          <ul style="padding-left:18px;margin:0 0 16px;">
            <li style="margin:6px 0;">${data.successCount} products added</li>
            ${data.errorCount > 0 ? `<li style="margin:6px 0;">${data.errorCount} rows skipped</li>` : ''}
            <li style="margin:6px 0;">${data.totalRows} total rows</li>
          </ul>
          ${
            data.errorCount > 0
              ? '<p style="margin:0 0 16px;color:#92400e;background:#fef3c7;padding:10px;border-radius:6px;">Download the error report from the import page to see which rows failed.</p>'
              : ''
          }
          <a href="${data.appUrl}/products/import" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">View Import Results</a>
        </div>
      </div>
    </div>
  `;

  await sendEmail(to, subject, html);
}

/**
 * 界面上的密钥遮罩（v102）：项目/邮箱/密钥只露一点，避免整串明文躺在屏幕上。
 * 默认接口与预设专用接口共用同一套规则。
 */

/** 服务账号邮箱：只留头两个字符与组织域名。 */
export function maskAccount(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email ? `${email.slice(0, 2)}••••` : '';
  return `${local.slice(0, 2)}••••@${domain}`;
}

/** Express 密钥：露头尾各一点，中间一律遮住。 */
export function maskSecret(secret: string): string {
  const text = secret.trim();
  if (!text) return '';
  return text.length <= 6 ? '••••••' : `${text.slice(0, 4)}••••••${text.slice(-2)}`;
}

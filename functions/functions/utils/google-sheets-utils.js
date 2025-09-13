// functions/utils/google-sheets-utils.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

/**
 * 處理 Google Service Account 的 JWT 驗證並取得 Access Token
 * @param {object} env - Cloudflare 環境變數
 * @returns {Promise<string>} - Google API Access Token
 */
async function getAccessToken(env) {
    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = env;

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        throw new Error('缺少 Google 服務帳號的環境變數。');
    }
    
    // 使用 RS256 演算法簽署 JWT
    const privateKey = await jose.importPKCS8(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
    const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
      .setAudience('https://oauth2.googleapis.com/token')
      .setSubject(GOOGLE_SERVICE_ACCOUNT_EMAIL)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    // 使用 JWT 換取 Access Token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
        throw new Error(`從 Google 取得 access token 失敗: ${tokenData.error_description || tokenData.error}`);
    }
    
    return tokenData.access_token;
}

/**
 * 連接到指定的 Google Sheet 工作表
 * @param {object} env - Cloudflare 環境變數
 * @param {string} sheetName - 要操作的工作表名稱 (例如: '使用者列表')
 * @returns {Promise<GoogleSpreadsheetWorksheet>} - GoogleSpreadsheet 的工作表實例
 */
export async function getSheet(env, sheetName) {
    const { GOOGLE_SHEET_ID } = env;
    if (!GOOGLE_SHEET_ID) {
        throw new Error('缺少 GOOGLE_SHEET_ID 環境變數。');
    }

    const accessToken = await getAccessToken(env);
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
        throw new Error(`在 Google Sheets 中找不到名為 "${sheetName}" 的工作表。`);
    }

    return sheet;
}

/**
 * 在指定的工作表中新增一列資料
 * @param {object} env - Cloudflare 環境變數
 * @param {string} sheetName - 工作表名稱
 * @param {object} rowData - 要新增的列資料物件 (key 為欄位標題)
 */
export async function addRowToSheet(env, sheetName, rowData) {
    const sheet = await getSheet(env, sheetName);
    await sheet.addRow(rowData);
}

/**
 * 更新指定工作表中的特定一列
 * @param {object} env - Cloudflare 環境變數
 * @param {string} sheetName - 工作表名稱
 * @param {string} matchColumn - 用來尋找列的欄位標題 (例如: 'user_id')
 * @param {string|number} matchValue - 要匹配的值
 * @param {object} updateData - 要更新的資料物件
 */
export async function updateRowInSheet(env, sheetName, matchColumn, matchValue, updateData) {
    const sheet = await getSheet(env, sheetName);
    const rows = await sheet.getRows();
    
    const rowToUpdate = rows.find(row => row.get(matchColumn) == matchValue);

    if (rowToUpdate) {
        Object.assign(rowToUpdate, updateData); // 使用 Object.assign 替代 .assign
        await rowToUpdate.save();
    } else {
        console.warn(`在工作表 "${sheetName}" 中找不到 ${matchColumn} 為 "${matchValue}" 的資料列，無法更新。`);
    }
}
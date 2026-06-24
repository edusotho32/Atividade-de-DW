const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Helper to wait
const delay = ms => new Promise(res => setTimeout(res, ms));

async function runTests() {
  console.log('Starting End-to-End Tests for SCCS...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track console errors
  const consoleErrors = [];
  page.on('pageerror', err => {
    console.error('Page error: ', err.message);
    consoleErrors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Console error: ', msg.text());
      consoleErrors.push(msg.text());
    }
  });

  const indexPath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
  console.log(`Loading application from: ${indexPath}`);
  
  await page.goto(indexPath, { waitUntil: 'networkidle0' });
  await delay(1000); // Wait for Babel to compile and React to render

  const results = {
    errors: [],
    pages: {},
    cruds: {},
    responsiveness: {},
    consoleErrors: []
  };

  // Helper to click sidebar nav buttons
  async function navigateTo(pageName) {
    console.log(`Navigating to page: ${pageName}`);
    const success = await page.evaluate((name) => {
      const links = Array.from(document.querySelectorAll('.sidebar .nav-link'));
      const target = links.find(l => l.textContent.trim().includes(name));
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, pageName);
    
    if (!success) {
      throw new Error(`Failed to navigate to page: ${pageName}`);
    }
    await delay(500);
  }

  // Helper to fill form inside modal
  async function fillModalForm(formData) {
    await page.evaluate((data) => {
      const getFormElement = (labelName) => {
        const labels = Array.from(document.querySelectorAll('.modal-box label'));
        const label = labels.find(l => l.textContent.trim().startsWith(labelName));
        if (!label) throw new Error(`Label "${labelName}" not found`);
        const container = label.parentElement;
        const input = container.querySelector('input, select, textarea');
        if (!input) throw new Error(`Input for label "${labelName}" not found`);
        return input;
      };

      for (const [label, val] of Object.entries(data)) {
        const input = getFormElement(label);
        if (input.tagName === 'SELECT') {
          input.value = val;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }, formData);
    await delay(300);
  }

  // Helper to click modal confirm/save button
  async function submitModal(btnText = 'Salvar') {
    await page.evaluate((text) => {
      const buttons = Array.from(document.querySelectorAll('.modal-box button'));
      const btn = buttons.find(b => b.textContent.trim() === text);
      if (btn) {
        btn.click();
      } else {
        throw new Error(`Modal button "${text}" not found`);
      }
    }, btnText);
    await delay(500);
  }

  // Helper to close modal by clicking cancel
  async function cancelModal() {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.modal-box button'));
      const btn = buttons.find(b => b.textContent.trim() === 'Cancelar');
      if (btn) btn.click();
    });
    await delay(300);
  }

  // Helper to read toast message
  async function getToastMessage() {
    return await page.evaluate(() => {
      const toast = document.querySelector('.toast-item');
      return toast ? toast.textContent.trim() : null;
    });
  }

  // Helper to dismiss toast
  async function dismissToast() {
    await page.evaluate(() => {
      const toast = document.querySelector('.toast-item');
      if (toast) toast.click();
    });
    await delay(200);
  }

  // Helper to count rows in tables
  async function getTableRowCount() {
    return await page.evaluate(() => {
      return document.querySelectorAll('table tbody tr').length;
    });
  }

  try {
    // ----------------------------------------------------
    // TEST DESKTOP RESPONSIVENESS & RENDER
    // ----------------------------------------------------
    await page.setViewport({ width: 1280, height: 800 });
    console.log('Testing Desktop view rendering...');
    const isSidebarVisible = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar && window.getComputedStyle(sidebar).display !== 'none';
    });
    results.responsiveness.desktop = isSidebarVisible ? 'PASS' : 'FAIL';
    
    // Save desktop screenshot
    await page.screenshot({ path: path.join(__dirname, 'desktop_dashboard.png') });
    console.log('Saved desktop_dashboard.png screenshot.');

    // ----------------------------------------------------
    // TEST PAGE NAVIGATION & LOADING
    // ----------------------------------------------------
    const pagesToTest = ['Dashboard', 'Pedido de Coleta', 'Recebimento', 'Envio de Materiais', 'Relatórios', 'Cadastros'];
    for (const p of pagesToTest) {
      try {
        await navigateTo(p);
        const headerText = await page.evaluate(() => {
          const h2 = document.querySelector('h2.page-title');
          return h2 ? h2.textContent.trim() : '';
        });
        
        console.log(`Page: ${p} header reads: "${headerText}"`);
        if (headerText.toLowerCase().includes(p.toLowerCase()) || (p === 'Envio de Materiais' && headerText.includes('Envio')) || (p === 'Dashboard' && headerText.includes('Dashboard'))) {
          results.pages[p] = 'PASS';
        } else {
          results.pages[p] = 'FAIL';
        }
      } catch (err) {
        console.error(`Error loading page ${p}:`, err.message);
        results.pages[p] = `FAIL (${err.message})`;
      }
    }

    // ----------------------------------------------------
    // TEST CRUD: PEDIDO DE COLETA (RF01)
    // ----------------------------------------------------
    console.log('Testing Pedido de Coleta (RF01)...');
    await navigateTo('Pedido de Coleta');
    const initialCollectCount = await getTableRowCount();
    
    // Open new request modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Novo Pedido'));
      if (btn) btn.click();
    });
    await delay(300);
    
    // Fill values
    await fillModalForm({
      'Cliente': '1', // Henrique Eduardo
      'Material': '1', // Papel
      'Bairro': '1', // Zumbi
      'Data': '2026-06-20',
      'Quantidade (Kg)': '25',
      'Volume (m³)': '15',
      'Status': 'Pendente'
    });
    
    await submitModal();
    let toast = await getToastMessage();
    console.log(`Toast returned: "${toast}"`);
    results.cruds.pedidoColetaInsert = (toast && toast.includes('registrado')) ? 'PASS' : `FAIL (${toast})`;
    await dismissToast();

    // Verify row count incremented
    const newCollectCount = await getTableRowCount();
    results.cruds.pedidoColetaTableRowAdded = (newCollectCount === initialCollectCount + 1) ? 'PASS' : 'FAIL';

    // Verify limit validation logic (RF01: Limit of 100Kg same material/month)
    console.log('Testing limit validation for Pedido de Coleta (RF01)...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Novo Pedido'));
      if (btn) btn.click();
    });
    await delay(300);
    
    await fillModalForm({
      'Cliente': '1',
      'Material': '1',
      'Bairro': '1',
      'Data': '2026-06-25',
      'Quantidade (Kg)': '90', // 25 + 50 (seed) + 90 = 165Kg (exceeds 100Kg)
      'Volume (m³)': '10'
    });
    await submitModal();
    toast = await getToastMessage();
    console.log(`Toast returned: "${toast}"`);
    results.cruds.pedidoColetaValidationLimit = (toast && toast.includes('Limite de 100 Kg')) ? 'PASS' : `FAIL (${toast})`;
    await dismissToast();
    await cancelModal();

    // ----------------------------------------------------
    // TEST CRUD: RECEBIMENTO (RF03)
    // ----------------------------------------------------
    console.log('Testing Recebimento de Materiais (RF03)...');
    await navigateTo('Recebimento');
    const initialReceiptCount = await getTableRowCount();

    // Test Role Validation: Gestor only
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Registrar'));
      if (btn) btn.click();
    });
    await delay(300);

    // Ana Souza is Collaborator 2 (cargoId 2 = Operador). This should fail because only Gestor is allowed.
    await fillModalForm({
      'ID da Coleta': 'COL-TEST-ERR',
      'Data': '2026-06-20',
      'Colaborador': '2', // Ana Souza (Operador)
      'Material': '2', // Plástico
      'Peso (Kg)': '30',
      'Volume (m³)': '20'
    });
    await submitModal();
    toast = await getToastMessage();
    console.log(`Validation toast for non-gestor: "${toast}"`);
    results.cruds.recebimentoRoleValidation = (toast && toast.includes('Somente colaboradores com cargo de Gestor')) ? 'PASS' : `FAIL (${toast})`;
    await dismissToast();

    // Now change Colaborador to João Costa (1, Gestor) and test successful insertion
    await fillModalForm({
      'Colaborador': '1' // João Costa (Gestor)
    });
    await submitModal();
    toast = await getToastMessage();
    console.log(`Success toast for Gestor: "${toast}"`);
    results.cruds.recebimentoInsert = (toast && toast.includes('registrado')) ? 'PASS' : `FAIL (${toast})`;
    await dismissToast();

    const newReceiptCount = await getTableRowCount();
    results.cruds.recebimentoTableRowAdded = (newReceiptCount === initialReceiptCount + 1) ? 'PASS' : 'FAIL';

    // ----------------------------------------------------
    // TEST CRUD: CADASTROS (RF01-RF24 CRUDs)
    // ----------------------------------------------------
    console.log('Testing Cadastros CRUDs (Tab: Clientes)...');
    await navigateTo('Cadastros');
    
    // Switch to Clientes tab
    await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('.nav-tabs-sccs .nav-link')).find(t => t.textContent.includes('Clientes'));
      if (tab) tab.click();
    });
    await delay(300);

    const initialClientsCount = await getTableRowCount();
    
    // Click Novo Cliente
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Novo Cliente'));
      if (btn) btn.click();
    });
    await delay(300);

    await fillModalForm({
      'Nome': 'E2E Test Client',
      'CPF': '999.999.999-99',
      'Email': 'e2e@test.com',
      'Telefone': '(28) 99999-9999',
      'Bairro': '2', // Centro
      'Rua': 'Rua de Teste Playwright',
      'Nº': '123',
      'Data de Cadastro': '2026-06-23'
    });
    await submitModal();
    toast = await getToastMessage();
    console.log(`Client insert toast: "${toast}"`);
    results.cruds.clientInsert = (toast && toast.includes('criado')) ? 'PASS' : `FAIL (${toast})`;
    await dismissToast();

    let newClientsCount = await getTableRowCount();
    results.cruds.clientTableRowAdded = (newClientsCount === initialClientsCount + 1) ? 'PASS' : 'FAIL';

    // Edit the created client
    console.log('Editing client...');
    await page.evaluate(() => {
      // Find the row containing "E2E Test Client" and click its "Editar" button
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const targetRow = rows.find(r => r.textContent.includes('E2E Test Client'));
      if (targetRow) {
        const editBtn = Array.from(targetRow.querySelectorAll('button')).find(b => b.textContent.includes('Editar'));
        if (editBtn) editBtn.click();
      } else {
        throw new Error('E2E Test Client row not found in table');
      }
    });
    await delay(300);

    await fillModalForm({
      'Nome': 'E2E Test Client Edited'
    });
    await submitModal();
    toast = await getToastMessage();
    console.log(`Client edit toast: "${toast}"`);
    results.cruds.clientEdit = (toast && toast.includes('atualizado')) ? 'PASS' : `FAIL (${toast})`;
    await dismissToast();

    // Verify it changed in table
    const tableHasEditedName = await page.evaluate(() => {
      return document.body.textContent.includes('E2E Test Client Edited');
    });
    results.cruds.clientNameUpdated = tableHasEditedName ? 'PASS' : 'FAIL';

    // Remove the client
    console.log('Removing client...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const targetRow = rows.find(r => r.textContent.includes('E2E Test Client Edited'));
      if (targetRow) {
        const delBtn = Array.from(targetRow.querySelectorAll('button')).find(b => b.textContent.includes('Remover'));
        if (delBtn) delBtn.click();
      }
    });
    await delay(300);

    // Confirm modal deletion
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Remover'));
      if (btn) btn.click();
    });
    await delay(500);
    toast = await getToastMessage();
    console.log(`Client delete toast: "${toast}"`);
    results.cruds.clientDelete = (toast && toast.includes('removido')) ? 'PASS' : `FAIL (${toast})`;
    await dismissToast();

    newClientsCount = await getTableRowCount();
    results.cruds.clientTableRowRemoved = (newClientsCount === initialClientsCount) ? 'PASS' : 'FAIL';

    // ----------------------------------------------------
    // TEST MOBILE RESPONSIVENESS
    // ----------------------------------------------------
    console.log('Testing Mobile view responsiveness...');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await navigateTo('Dashboard');
    await delay(500);

    // Save mobile screenshot
    await page.screenshot({ path: path.join(__dirname, 'mobile_dashboard.png') });
    console.log('Saved mobile_dashboard.png screenshot.');

    // Check if sidebar collapses on mobile
    const isSidebarResponsive = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const main = document.querySelector('.main-content');
      
      const sidebarWidth = sidebar.getBoundingClientRect().width;
      const mainMarginLeft = window.getComputedStyle(main).marginLeft;
      
      return {
        sidebarWidth,
        mainMarginLeft
      };
    });
    
    results.responsiveness.mobile = (isSidebarResponsive.sidebarWidth > 350 && isSidebarResponsive.mainMarginLeft === '0px') ? 'PASS' : 'FAIL';

  } catch (err) {
    console.error('Test execution failed with error:', err.message);
    results.errors.push(err.message);
  } finally {
    results.consoleErrors = consoleErrors;
    await browser.close();
    
    // Write results report
    fs.writeFileSync(path.join(__dirname, 'test_results.json'), JSON.stringify(results, null, 2));
    console.log('E2E Tests Completed. Saved test_results.json.');
  }
}

runTests();

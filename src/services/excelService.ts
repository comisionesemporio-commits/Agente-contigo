import * as XLSX from 'xlsx';
import { ClientPolicy } from '../types';
import { formatToUSDate, calculateAgeFromDBO } from './storage';

// Definición canónica de las columnas requeridas por el usuario
export const CANONICAL_EXCEL_HEADERS = [
  'Estatus',
  'Activos',
  'Nombre y apellido',
  'Dependientes',
  'Compañías de seguros',
  'Fecha de nacimiento',
  'Dirección',
  'Plan',
  'Vendedor',
  'Prima ($)',
  'Teléfono',
  'Social (SSN)',
  'Edad',
  'Ingreso ($)',
  'Peso',
  'Altura',
  'Banco',
  'Pago Realizado'
];

// Mapeador de sinónimos de columnas (sin acentos, minúsculas, sin espacios extra)
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

interface ColumnMapping {
  estatus?: number;
  mesIngreso?: number;
  nombre?: number;
  numDependientes?: number;
  carrier?: number;
  dbo?: number;
  direccion?: number;
  nombrePlan?: number;
  vendedor?: number;
  primaMonto?: number;
  telefono?: number;
  ssn?: number;
  edad?: number;
  ingresoMonto?: number;
  peso?: number;
  altura?: number;
  bancoNombre?: number;
  pagoRealizado?: number;
  numPoliza?: number;
  agente?: number;
  estadoUSA?: number;
  estatusMigratorio?: number;
}

export function detectColumnMappings(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  headers.forEach((rawH, index) => {
    const h = normalizeKey(String(rawH || ''));
    if (!h) return;

    // Detectar estatus migratorio PRIMERO para no confundirlo con el estatus de la póliza (Activo / Cancelado)
    if (h.includes('migratorio') || h.includes('inmigra') || h.includes('immigration') || h.includes('visa') || h.includes('parole') || h.includes('daca') || h.includes('permisotrabajo')) {
      if (mapping.estatusMigratorio === undefined) mapping.estatusMigratorio = index;
    } else if (h.includes('estatus') || h.includes('status') || h === 'estado') {
      if (mapping.estatus === undefined) mapping.estatus = index;
    } else if (h.includes('activo') || h.includes('vigencia') || h.includes('mesingreso') || h.includes('activodesde')) {
      if (mapping.mesIngreso === undefined) mapping.mesIngreso = index;
    } else if (h.includes('nombre') || h.includes('cliente') || h.includes('nombres') || h.includes('fullname')) {
      if (mapping.nombre === undefined) mapping.nombre = index;
    } else if (h.includes('dependiente') || h.includes('miembro') || h.includes('carga') || h.includes('integrante')) {
      if (mapping.numDependientes === undefined) mapping.numDependientes = index;
    } else if (h.includes('compania') || h.includes('carrier') || h.includes('seguro') || h.includes('aseguradora') || h.includes('companiasdeseguros')) {
      if (mapping.carrier === undefined) mapping.carrier = index;
    } else if (h.includes('nacimiento') || h.includes('dbo') || h.includes('dob') || h.includes('fechanac') || h.includes('birth')) {
      if (mapping.dbo === undefined) mapping.dbo = index;
    } else if (h.includes('direccion') || h.includes('address') || h.includes('domicilio')) {
      if (mapping.direccion === undefined) mapping.direccion = index;
    } else if (h === 'plan' || h.includes('nombreplan') || h.includes('cobertura') || h.includes('plandesalud')) {
      if (mapping.nombrePlan === undefined) mapping.nombrePlan = index;
    } else if (h.includes('vendedor') || h.includes('asesor') || h.includes('seller')) {
      if (mapping.vendedor === undefined) mapping.vendedor = index;
    } else if (h.includes('agente') || h.includes('agent')) {
      if (mapping.agente === undefined) mapping.agente = index;
    } else if (h.includes('prima') || h.includes('premium') || h.includes('cuota')) {
      if (mapping.primaMonto === undefined) mapping.primaMonto = index;
    } else if (h.includes('telefono') || h.includes('phone') || h.includes('celular') || h.includes('movil') || h.includes('contacto')) {
      if (mapping.telefono === undefined) mapping.telefono = index;
    } else if (h.includes('social') || h.includes('ssn') || h.includes('segurosocial')) {
      if (mapping.ssn === undefined) mapping.ssn = index;
    } else if (h.includes('edad') || h.includes('age') || h.includes('anos')) {
      if (mapping.edad === undefined) mapping.edad = index;
    } else if (h.includes('ingreso') || h.includes('income') || h.includes('salario')) {
      if (mapping.ingresoMonto === undefined) mapping.ingresoMonto = index;
    } else if (h.includes('peso') || h.includes('weight') || h.includes('libras')) {
      if (mapping.peso === undefined) mapping.peso = index;
    } else if (h.includes('altura') || h.includes('height') || h.includes('estatura')) {
      if (mapping.altura === undefined) mapping.altura = index;
    } else if (h.includes('banco') || h.includes('bank')) {
      if (mapping.bancoNombre === undefined) mapping.bancoNombre = index;
    } else if (h.includes('pago') || h.includes('paid')) {
      if (mapping.pagoRealizado === undefined) mapping.pagoRealizado = index;
    } else if (h.includes('poliza') || h.includes('policy')) {
      if (mapping.numPoliza === undefined) mapping.numPoliza = index;
    } else if (h.includes('estado') || h.includes('state')) {
      if (mapping.estadoUSA === undefined) mapping.estadoUSA = index;
    }
  });

  return mapping;
}

// Convierte un valor de fecha cualquiera (serial Excel, texto ISO, etc.) en MM/DD/YYYY
export function parseDateFlexible(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Es fecha numérica de Excel
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj) {
        const mm = String(dateObj.m).padStart(2, '0');
        const dd = String(dateObj.d).padStart(2, '0');
        const yyyy = String(dateObj.y);
        return `${mm}/${dd}/${yyyy}`;
      }
    } catch (_) {}
  }

  const str = String(val).trim();
  if (!str) return '';
  return formatToUSDate(str);
}

// Parsea un número flotante de moneda limpio ($1,234.50 -> 1234.50)
export function parseCleanNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseExcelOrCSVBuffer(buffer: ArrayBuffer, selectedYear: string): { clients: ClientPolicy[], detectedHeaders: string[] } {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { clients: [], detectedHeaders: [] };

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length < 2) {
    return { clients: [], detectedHeaders: [] };
  }

  // Identificar la fila de encabezados (suele ser fila 0, o fila con textos de columna)
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = rawRows[r];
    const nonEmpties = row.filter((c: any) => typeof c === 'string' && c.trim().length > 0);
    if (nonEmpties.length >= 3) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = (rawRows[headerRowIndex] || []).map((h: any) => String(h || '').trim());
  const mapping = detectColumnMappings(rawHeaders);

  const clients: ClientPolicy[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    // Obtener valores según mapeo o según orden canónico por defecto si no se detectaron nombres
    const getVal = (idx?: number, fallbackOrderIdx?: number): any => {
      if (idx !== undefined && row[idx] !== undefined) return row[idx];
      if (fallbackOrderIdx !== undefined && row[fallbackOrderIdx] !== undefined) return row[fallbackOrderIdx];
      return '';
    };

    const rawNombre = String(getVal(mapping.nombre, 2) || '').trim();
    if (!rawNombre || rawNombre === 'Sin Nombre' || rawNombre.toLowerCase() === 'nombre') {
      // Ignorar filas vacías o subtítulos
      const anyData = row.some((cell: any) => String(cell || '').trim().length > 0);
      if (!anyData) continue;
      if (!rawNombre) continue;
    }

    let estatusRaw = String(getVal(mapping.estatus, 0) || 'Activo').trim();
    let estatusMigratorioRaw = String(getVal(mapping.estatusMigratorio) || '').trim();

    // Limpieza de estatus: si dice ciudadanos, residentes, permiso, etc., poner Activo
    const lowerEst = estatusRaw.toLowerCase();
    const isMigratory = (
      lowerEst.includes('ciudadan') ||
      lowerEst.includes('resident') ||
      lowerEst.includes('permiso') ||
      lowerEst.includes('parole') ||
      lowerEst.includes('daca') ||
      lowerEst.includes('visa') ||
      lowerEst.includes('asilo') ||
      lowerEst.includes('tps') ||
      lowerEst.includes('indocument') ||
      lowerEst.includes('green card') ||
      lowerEst.includes('work permit')
    );

    if (isMigratory) {
      if (!estatusMigratorioRaw) estatusMigratorioRaw = estatusRaw;
      estatusRaw = 'Activo';
    } else if (lowerEst === 'activos' || lowerEst === 'activo' || lowerEst === 'active') {
      estatusRaw = 'Activo';
    } else if (lowerEst.includes('cancel')) {
      estatusRaw = 'Cancelado';
    } else if (lowerEst.includes('rob')) {
      estatusRaw = 'Robado';
    } else if (lowerEst === 'nuevo' || lowerEst === 'pendiente' || lowerEst === 'subido / listo') {
      // conservar
    } else {
      estatusRaw = 'Activo';
    }

    const mesIngresoRaw = String(getVal(mapping.mesIngreso, 1) || 'Enero').trim();
    const dependientesRaw = parseInt(String(getVal(mapping.numDependientes, 3) || '0'), 10) || 0;
    const carrierRaw = String(getVal(mapping.carrier, 4) || 'General').trim();
    const rawDbo = getVal(mapping.dbo, 5);
    const dboParsed = parseDateFlexible(rawDbo);
    const direccionRaw = String(getVal(mapping.direccion, 6) || '').trim();
    const planRaw = String(getVal(mapping.nombrePlan, 7) || '').trim();
    const vendedorRaw = String(getVal(mapping.vendedor, 8) || 'General').trim();
    const primaRaw = parseCleanNumber(getVal(mapping.primaMonto, 9));
    const telefonoRaw = String(getVal(mapping.telefono, 10) || '').trim();
    const ssnRaw = String(getVal(mapping.ssn, 11) || '').trim();
    const edadRaw = parseInt(String(getVal(mapping.edad, 12) || '0'), 10) || (dboParsed ? calculateAgeFromDBO(dboParsed) : 0);
    const ingresoRaw = parseCleanNumber(getVal(mapping.ingresoMonto, 13));
    const pesoRaw = String(getVal(mapping.peso, 14) || '').trim();
    const alturaRaw = String(getVal(mapping.altura, 15) || '').trim();
    const bancoRaw = String(getVal(mapping.bancoNombre, 16) || '').trim();
    const pagoRaw = String(getVal(mapping.pagoRealizado, 17) || 'TRUE').toUpperCase();
    const isPaid = pagoRaw === 'TRUE' || pagoRaw === 'SI' || pagoRaw === 'SÍ' || pagoRaw === '1';

    const client: ClientPolicy = {
      id: 'client-imp-' + Date.now() + '-' + r + '-' + Math.floor(Math.random() * 1000),
      nombre: rawNombre,
      estatus: estatusRaw,
      mesIngreso: mesIngresoRaw || 'Enero',
      numDependientes: dependientesRaw,
      carrier: carrierRaw || 'Oscar',
      dbo: dboParsed,
      direccion: direccionRaw,
      nombrePlan: planRaw,
      vendedor: vendedorRaw,
      agente: (mapping.agente !== undefined ? String(row[mapping.agente] || '') : '') || vendedorRaw,
      primaMonto: primaRaw,
      telefono: telefonoRaw,
      ssn: ssnRaw,
      edad: edadRaw,
      ingresoMonto: ingresoRaw,
      peso: pesoRaw,
      altura: alturaRaw,
      bancoNombre: bancoRaw,
      bancoTipoCuenta: 'Corriente (Checking)',
      bancoTitular: '',
      bancoRouting: '',
      bancoCuenta: '',
      cuestionarioSalud: {},
      commissions: {},
      docStatus: 'Documento Completos',
      estatusMigratorio: estatusMigratorioRaw || 'Ciudadano',
      ingresoFecha: '',
      metodoPago: 'Tarjeta de Crédito',
      estadoUSA: (mapping.estadoUSA !== undefined ? String(row[mapping.estadoUSA] || 'GA') : 'GA').toUpperCase() || 'GA',
      email: '',
      numPoliza: mapping.numPoliza !== undefined ? String(row[mapping.numPoliza] || '') : '',
      pagoRealizado: isPaid ? 'TRUE' : 'FALSE',
      notas: 'Importado vía Excel/CSV',
      createdDate: new Date().toLocaleDateString(),
      createdYear: selectedYear
    };

    clients.push(client);
  }

  return { clients, detectedHeaders: rawHeaders };
}

// Descarga un archivo Excel (.xlsx) con las columnas exactamente organizadas
export function exportToExcelFile(clients: ClientPolicy[], filename = 'Polizas_AgenteContigo.xlsx') {
  const rows = clients.map(c => ({
    'Estatus': c.estatus || 'Activo',
    'Activos': c.mesIngreso || 'Enero',
    'Nombre y apellido': c.nombre || '',
    'Dependientes': c.numDependientes || 0,
    'Compañías de seguros': c.carrier || 'General',
    'Fecha de nacimiento': c.dbo || '',
    'Dirección': c.direccion || '',
    'Plan': c.nombrePlan || '',
    'Vendedor': c.vendedor || 'General',
    'Prima ($)': c.primaMonto || 0,
    'Teléfono': c.telefono || '',
    'Social (SSN)': c.ssn || '',
    'Edad': c.edad || 0,
    'Ingreso ($)': c.ingresoMonto || 0,
    'Peso': c.peso || '',
    'Altura': c.altura || '',
    'Banco': c.bancoNombre || '',
    'Pago Realizado': String(c.pagoRealizado).toUpperCase() === 'TRUE' ? 'SÍ' : 'NO'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: CANONICAL_EXCEL_HEADERS });

  // Configurar anchos de columna para que se vea impecable en Excel
  worksheet['!cols'] = [
    { wch: 12 }, // Estatus
    { wch: 12 }, // Activos
    { wch: 28 }, // Nombre y apellido
    { wch: 14 }, // Dependientes
    { wch: 22 }, // Compañías de seguros
    { wch: 18 }, // Fecha de nacimiento
    { wch: 30 }, // Dirección
    { wch: 25 }, // Plan
    { wch: 18 }, // Vendedor
    { wch: 12 }, // Prima ($)
    { wch: 16 }, // Teléfono
    { wch: 16 }, // Social (SSN)
    { wch: 8 },  // Edad
    { wch: 14 }, // Ingreso ($)
    { wch: 10 }, // Peso
    { wch: 10 }, // Altura
    { wch: 16 }, // Banco
    { wch: 14 }  // Pago Realizado
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pólizas');
  XLSX.writeFile(workbook, filename);
}

// Descarga una plantilla modelo vacía con 3 filas de ejemplo para el usuario
export function downloadExcelTemplate() {
  const sampleRows = [
    {
      'Estatus': 'Activo',
      'Activos': 'Enero',
      'Nombre y apellido': 'Juan Carlos Rodríguez',
      'Dependientes': 2,
      'Compañías de seguros': 'Florida Blue',
      'Fecha de nacimiento': '05/14/1982',
      'Dirección': '123 Ocean Drive, Miami, FL 33139',
      'Plan': 'BlueOptions Silver 1410',
      'Vendedor': 'Yusmery',
      'Prima ($)': 45.50,
      'Teléfono': '305-555-0199',
      'Social (SSN)': '123-45-6789',
      'Edad': 42,
      'Ingreso ($)': 32000,
      'Peso': '175 lbs',
      'Altura': "5'9\"",
      'Banco': 'Chase Bank',
      'Pago Realizado': 'SÍ'
    },
    {
      'Estatus': 'Activo',
      'Activos': 'Febrero',
      'Nombre y apellido': 'María Elena Gómez',
      'Dependientes': 0,
      'Compañías de seguros': 'Ambetter',
      'Fecha de nacimiento': '11/22/1990',
      'Dirección': '456 Peachtree St, Atlanta, GA 30308',
      'Plan': 'Ambetter Balanced Care 11',
      'Vendedor': 'Carlos',
      'Prima ($)': 0.00,
      'Teléfono': '404-555-0144',
      'Social (SSN)': '987-65-4321',
      'Edad': 34,
      'Ingreso ($)': 24500,
      'Peso': '140 lbs',
      'Altura': "5'4\"",
      'Banco': 'Bank of America',
      'Pago Realizado': 'SÍ'
    },
    {
      'Estatus': 'Nuevo por procesar',
      'Activos': 'Marzo',
      'Nombre y apellido': 'Pedro Luis Martínez',
      'Dependientes': 1,
      'Compañías de seguros': 'Oscar',
      'Fecha de nacimiento': '08/03/1976',
      'Dirección': '789 Houston Ave, Houston, TX 77002',
      'Plan': 'Oscar Classic Bronze',
      'Vendedor': 'Yusmery',
      'Prima ($)': 12.00,
      'Teléfono': '713-555-0177',
      'Social (SSN)': '456-78-1234',
      'Edad': 48,
      'Ingreso ($)': 28000,
      'Peso': '185 lbs',
      'Altura': "5'11\"",
      'Banco': 'Wells Fargo',
      'Pago Realizado': 'NO'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: CANONICAL_EXCEL_HEADERS });
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 28 },
    { wch: 14 },
    { wch: 24 },
    { wch: 20 },
    { wch: 35 },
    { wch: 28 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 8 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Clientes');
  XLSX.writeFile(workbook, 'Plantilla_Clientes_AgenteContigo.xlsx');
}

/**
 * Configuracion.gs - Centraliza nombres de hojas, índices de columnas y IDs de carpetas.
 */

const CONFIG = {
  // MAESTROS
  SHEET_PACIENTES: 'Pacientes',
  SHEET_ITEMS: 'BD_Items',

  // CLÍNICA (SALIDAS)
  SHEET_ATENCIONES: 'Historial_Atenciones',
  SHEET_DETALLE: 'Detalle_Movimientos',

  // LOGÍSTICA (ENTRADAS)    
  SHEET_CARGAS: 'Registro_Cargas',
  SHEET_INGRESOS: 'Detalle_Ingresos',

  // FINANZAS
  SHEET_REPORTE_CAJAS: 'Reporte_Cajas',

  // IDs de Carpetas
  FOLDER_ID_PACIENTES: "16-c5GaNZdbqOsQxJPm1S9pUnPFFMZKoQ",
  FOLDER_ID_PDFS: "1wI3gMoiTilmNMtZzHBnSkBfET0NJm5S6",

  // LISTA DE USUARIOS (Para los desplegables)
  USUARIOS_AUTORIZADOS: [
    "Valentina Riquelme Melgarejo",
    "Paula Rodriguez Vergara"
  ]
};

// 1. PACIENTES
const COL_PACIENTES = {
  ID: 1, RUN: 2, DV: 3, NOMBRE: 4, EMAIL: 5, TELEFONO: 6, CONVENIO: 7, CARPETA_PACIENTE: 8, FECHA_ATENCION: 9,
  LINK_ULTIMO_DOC: 10
};

// 2. ITEMS
const COL_ITEMS = {
  CODIGO: 1, NOMBRE: 2, TIPO: 3, STOCK: 4, MINIMO: 5, PRECIO: 6
};

// 3. ATENCIONES
const COL_ATENCIONES = {
  ID_ATENCION: 1, FECHA: 2, RUN: 3, NOMBRE: 4, CONVENIO: 5, ATENCION: 6, ESTADO: 7, LINK_ENTREGA: 8, LINK_COBRO: 9, NRO_CRI: 10, USUARIO: 11
};

// 4. DETALLE MOVIMIENTOS
const COL_DETALLE = {
  ID_ATENCION: 1, CODIGO: 2, NOMBRE: 3, CANTIDAD: 4, MOVIMIENTO: 5
};

// 5. REGISTRO CARGAS
const COL_CARGAS = {
  ID_CARGA: 1, FECHA: 2, USUARIO: 3, REFERENCIA: 4, CANT_ITEMS: 5
};

// 6. DETALLE INGRESOS (Detalle Entrada)
const COL_INGRESOS = {
  ID_CARGA: 1, CODIGO: 2, NOMBRE: 3, CANTIDAD: 4
}

// 7. REPORTE CAJAS
const COL_REPORTE_CAJAS = {
  ID_ATENCION: 1, FECHA: 2, RUN: 3, NOMBRE: 4, CONVENIO: 5, TOTAL_VALOR: 6, ESTADO_CRI: 7, INPUT_CRI: 8, LINK_DOC: 9
}
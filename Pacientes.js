/**
 * Pacientes.gs - Gestión de Paciente con Carpeta Digital
 */

function mostrarSidebarEditarPaciente(runParam) {
  const template = HtmlService.createTemplateFromFile('SidebarEditarPaciente');
  // Usamos el escudo para evitar errores si se abre desde el menú superior
  template.runAuto = (typeof runParam === 'string') ? runParam : "";
  const html = template.evaluate().setWidth(500).setHeight(650);
  SpreadsheetApp.getUi().showModelessDialog(html, '✏️ Editar / Corregir Paciente');
}

function mostrarSidebarPacientes(runParam) {
  const template = HtmlService.createTemplateFromFile('SidebarPacientes');
  // Usamos el escudo para evitar errores si se abre desde el menú superior
  template.runAuto = (typeof runParam === 'string') ? runParam : "";
  const html = template.evaluate().setWidth(500).setHeight(650);
  SpreadsheetApp.getUi().showModelessDialog(html, '👤 Nuevo Paciente');
}

function guardarNuevoPaciente(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(CONFIG.SHEET_PACIENTES);
  
  try {
    // 1. Validar Duplicados
    if (buscarPacienteBackend(datos.run).encontrado) {
      return { success: false, mensaje: "El RUN ya existe." };
    }

    // 2. Crear Carpeta Digital en Drive
    let urlCarpeta = "";
    try {
      const carpetaRaiz = DriveApp.getFolderById(CONFIG.FOLDER_ID_PACIENTES);
      const nombreCarpeta = `${datos.run}-${calcularDV(datos.run)} ${datos.nombre.toUpperCase()}`;
      const nuevaCarpeta = carpetaRaiz.createFolder(nombreCarpeta);
      urlCarpeta = nuevaCarpeta.getUrl();
    } catch (e) {
      console.warn("Error creando carpeta Drive: " + e.message);
      urlCarpeta = "Error al crear carpeta";
    }

    // 3. Generar Datos
    const idCorrelativo = obtenerSiguienteCorrelativo(CONFIG.SHEET_PACIENTES, 1);
    const dv = calcularDV(datos.run);

    // 4. Preparar Fila (Array de 10 columnas)
    let fila = new Array(10).fill("");
    fila[COL_PACIENTES.ID - 1] = idCorrelativo;
    fila[COL_PACIENTES.RUN - 1] = String(datos.run).trim();
    fila[COL_PACIENTES.DV - 1] = dv;
    fila[COL_PACIENTES.NOMBRE - 1] = datos.nombre.toUpperCase();
    fila[COL_PACIENTES.EMAIL - 1] = datos.email || "";
    fila[COL_PACIENTES.TELEFONO - 1] = datos.telefono || "";
    fila[COL_PACIENTES.CONVENIO - 1] = datos.convenio;
    fila[COL_PACIENTES.CARPETA_PACIENTE - 1] = urlCarpeta;

    // Las columnas I (Fecha) y J (Link Doc) quedan vacías al crear, se llenan al atender.

    // 5. Guardar
    ws.appendRow(fila);
    
    return { success: true, mensaje: `Paciente registrado con Carpeta Digital.` };

  } catch (e) {
    return { success: false, mensaje: "Error: " + e.message };
  }
}

// Búsqueda simple para validar duplicados
function buscarPacienteBackend(run) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(CONFIG.SHEET_PACIENTES);
  const data = ws.getDataRange().getValues();
  
  // 1. Limpieza Inteligente: Tomamos lo que esté antes del guión y dejamos solo números
  let runBuscadoStr = String(run).toUpperCase();
  if (runBuscadoStr.includes("-")) {
    runBuscadoStr = runBuscadoStr.split("-")[0];
  }
  const runBuscadoNum = runBuscadoStr.replace(/[^0-9]/g, '');

  // Empezamos desde 1 para saltar encabezados
  for (let i = 1; i < data.length; i++) {
    // 2. Limpieza de la celda (Columna B)
    const celdaRun = String(data[i][COL_PACIENTES.RUN - 1]).replace(/[^0-9]/g, '');

    // 3. Comparación exacta de números
    if (celdaRun === runBuscadoNum && celdaRun !== "") {
      return {
        encontrado: true,
        nombre: data[i][COL_PACIENTES.NOMBRE - 1],
        // Variable runCompleto (con N) para que coincida con el HTML
        runCompleto: `${data[i][COL_PACIENTES.RUN - 1]}-${data[i][COL_PACIENTES.DV - 1]}`,
        convenio: data[i][COL_PACIENTES.CONVENIO - 1] || "LEY"
      };
    }
  }
  
  return { encontrado: false };
}

// --- ZONA DE EDICIÓN DE PACIENTES ---

/**
 * Busca un paciente para editar. Retorna todos los datos actuales incluyendo la fila donde está.
 */
function buscarPacienteParaEdicion(runBusqueda) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(CONFIG.SHEET_PACIENTES);
  const data = ws.getDataRange().getValues();
  
  // Usamos la misma lógica numérica para consistencia
  let runBuscadoStr = String(runBusqueda).toUpperCase();
  if (runBuscadoStr.includes("-")) runBuscadoStr = runBuscadoStr.split("-")[0];
  const runLimpio = runBuscadoStr.replace(/[^0-9]/g, '');

  for (let i = 1; i < data.length; i++) {
    const runFila = String(data[i][COL_PACIENTES.RUN - 1]).replace(/[^0-9]/g, '');

    if (runFila === runLimpio && runFila !== "") {
      return {
        encontrado: true,
        fila: i + 1,
        id: data[i][COL_PACIENTES.ID - 1],
        run: data[i][COL_PACIENTES.RUN - 1],
        nombre: data[i][COL_PACIENTES.NOMBRE - 1],
        email: data[i][COL_PACIENTES.EMAIL - 1],
        telefono: data[i][COL_PACIENTES.TELEFONO - 1],
        convenio: data[i][COL_PACIENTES.CONVENIO - 1] 
      };
    }
  }
  return { encontrado: false };
}

/**
 * Guarda los cambios realizados en el formulario.
 */
function guardarEdicionPaciente(datos) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ws = ss.getSheetByName(CONFIG.SHEET_PACIENTES);
    const fila = parseInt(datos.fila);

    // Validación de seguridad: Asegurarnos que la fila sigue teniendo ese ID
    const idEnFila = ws.getRange(fila, COL_PACIENTES.ID).getValue();
    if (String(idEnFila) !== String(datos.id)) {
      throw new Error("La hoja cambió de orden. Busque al paciente nuevamente.");
    }

    // Recalcular DV por si cambiaron el RUN (corrección de errores)
    const nuevoDV = calcularDV(datos.run);

    // Actualizar celdas específicas
    ws.getRange(fila, COL_PACIENTES.RUN).setValue(datos.run);
    ws.getRange(fila, COL_PACIENTES.DV).setValue(nuevoDV);
    ws.getRange(fila, COL_PACIENTES.NOMBRE).setValue(datos.nombre.toUpperCase());
    ws.getRange(fila, COL_PACIENTES.EMAIL).setValue(datos.email);
    ws.getRange(fila, COL_PACIENTES.TELEFONO).setValue(datos.telefono);
    ws.getRange(fila, COL_PACIENTES.CONVENIO).setValue(datos.convenio);

    return { success: true, mensaje: "Datos actualizados correctamente." };

  } catch (e) {
    return { success: false, mensaje: e.message };
  }
}

/**
 * Utilidades.gs - Funciones de utilidad general para el sistema.
 */

/**
 * Obtiene el siguiente número correlativo (Auto-Increment) de una columna. Busca el valor máximo actual y le suma 1.
 */
function obtenerSiguienteCorrelativo(nombreHoja, numColumna) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(nombreHoja);
  
  // Si la hoja no existe o está vacía (solo headers), partimos del 1
  if (!ws || ws.getLastRow() <= 1) {
    return 1;
  }

  // Obtenemos todos los datos de esa columna (desde fila 2 hasta la última)
  const rango = ws.getRange(2, numColumna, ws.getLastRow() - 1, 1);
  const valores = rango.getValues().flat(); // Convierte [[1], [2]] en [1, 2]

  // Filtramos solo los que sean números válidos
  const numeros = valores.filter(val => typeof val === 'number' && isFinite(val));

  if (numeros.length === 0) {
    return 1;
  }

  // Buscamos el máximo y sumamos 1
  const maximo = Math.max(...numeros);
  return maximo + 1;
}

/**
 * Calcula el Dígito Verificador (DV) para un RUN usando el algoritmo Módulo 11.
 */
function calcularDV(run) {
  try {
    let runStr = String(run).replace(/[^0-9]/g, ''); // Limpiar RUN
    if (runStr === '') return '';

    let suma = 0;
    let multiplo = 2;

    for (let i = runStr.length - 1; i >= 0; i--) {
      suma += parseInt(runStr.charAt(i), 10) * multiplo;
      multiplo++;
      if (multiplo > 7) {
        multiplo = 2;
      }
    }

    const resto = suma % 11;
    let dv = 11 - resto;

    if (dv === 11) return '0';
    if (dv === 10) return 'K';
    return String(dv);

  } catch (e) {
    console.error(`Error al calcular DV para ${run}: ${e.message}`);
    return '';
  }
}

/**
 * Función auxiliar para encontrar la primera fila visualmente vacía basándose en la Columna A, ignorando validaciones en otras columnas.
 */
function obtenerPrimeraFilaVacia(hoja) {
  // Obtenemos solo la columna A para ser rápidos
  const columnaA = hoja.getRange("A:A").getValues();
  // Recorremos buscando el primer hueco (empezando de fila 2 para saltar header)
  for (let i = 1; i < columnaA.length; i++) {
    if (columnaA[i][0] === "") {
      return i + 1; // +1 porque los arrays empiezan en 0 pero las filas en 1
    }
  }
  return columnaA.length + 1;
}
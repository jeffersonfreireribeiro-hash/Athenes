package com.athenes.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Draw
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import com.athenes.DestinoPrincipal

/** Os mesmos quatro destinos no celular e nas janelas médias/largas. */
@Composable
fun NavegacaoPrincipal(destino: DestinoPrincipal, compacta: Boolean, onDestino: (DestinoPrincipal) -> Unit) {
    if (compacta) {
        NavigationBar {
            DestinoPrincipal.entries.forEach { item ->
                NavigationBarItem(
                    selected = destino == item,
                    onClick = { onDestino(item) },
                    icon = { Icon(iconeDestino(item), contentDescription = null) },
                    label = { Text(item.rotulo) }
                )
            }
        }
    } else {
        NavigationRail {
            DestinoPrincipal.entries.forEach { item ->
                NavigationRailItem(
                    selected = destino == item,
                    onClick = { onDestino(item) },
                    icon = { Icon(iconeDestino(item), contentDescription = null) },
                    label = { Text(item.rotulo) }
                )
            }
        }
    }
}

private fun iconeDestino(destino: DestinoPrincipal): ImageVector = when (destino) {
    DestinoPrincipal.DOCUMENTOS -> Icons.Rounded.Description
    DestinoPrincipal.BIBLIOTECA -> Icons.AutoMirrored.Rounded.MenuBook
    DestinoPrincipal.ESTUDO -> Icons.Rounded.Draw
    DestinoPrincipal.CONTA -> Icons.Rounded.Person
}

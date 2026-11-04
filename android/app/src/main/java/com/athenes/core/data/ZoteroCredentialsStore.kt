package com.athenes.core.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** A chave do Zotero permanece criptografada no armazenamento privado deste aparelho. */
class ZoteroCredentialsStore(context: Context) {
    private val preferencias = context.applicationContext.getSharedPreferences("zotero_credenciais", Context.MODE_PRIVATE)
    private val alias = "athenes_zotero_api_key"

    fun salvar(chave: String, usuarioId: String) {
        require(chave.isNotBlank()) { "Informe a chave do Zotero." }
        val cifra = Cipher.getInstance("AES/GCM/NoPadding")
        cifra.init(Cipher.ENCRYPT_MODE, obterOuCriarChave())
        val dados = JSONObject().put("chave", chave.trim()).put("usuarioId", usuarioId.trim()).toString()
        val criptografado = cifra.doFinal(dados.toByteArray(Charsets.UTF_8))
        preferencias.edit()
            .putString("iv", Base64.encodeToString(cifra.iv, Base64.NO_WRAP))
            .putString("dados", Base64.encodeToString(criptografado, Base64.NO_WRAP))
            .apply()
    }

    fun carregar(): Pair<String, String>? {
        val iv = preferencias.getString("iv", null) ?: return null
        val dados = preferencias.getString("dados", null) ?: return null
        return runCatching {
            val cifra = Cipher.getInstance("AES/GCM/NoPadding")
            cifra.init(Cipher.DECRYPT_MODE, obterOuCriarChave(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
            val json = JSONObject(String(cifra.doFinal(Base64.decode(dados, Base64.NO_WRAP)), Charsets.UTF_8))
            json.getString("chave") to json.optString("usuarioId")
        }.getOrNull()
    }

    fun remover() {
        preferencias.edit().clear().apply()
    }

    private fun obterOuCriarChave(): SecretKey {
        val armazenador = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (armazenador.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build())
        }.generateKey()
    }
}

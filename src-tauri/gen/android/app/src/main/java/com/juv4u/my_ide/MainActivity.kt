package com.juv4u.my_ide

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // FT8 decoding needs the microphone. Declaring RECORD_AUDIO in the
    // manifest alone is not enough on API 23+: the WebView's getUserMedia
    // reports NotAllowedError ("заборонено") unless the OS-level runtime
    // grant already exists when the page asks for audio. Ask up front so
    // the grant exists before the FT8 panel ever calls getUserMedia.
    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        != PackageManager.PERMISSION_GRANTED
    ) {
      ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.RECORD_AUDIO),
        FT8_MIC_REQUEST_CODE,
      )
    }
  }

  companion object {
    private const val FT8_MIC_REQUEST_CODE = 47821
  }
}

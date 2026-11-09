using UnityEditor;
using UnityEngine;

namespace SunsetPursuit.Editor
{
    public sealed class TextureImport : AssetPostprocessor
    {
        private void OnPreprocessTexture()
        {
            if (!(assetImporter is TextureImporter texture)) return;
            if (assetPath.EndsWith("cloud-volume.png"))
            {
                texture.textureType=TextureImporterType.Default;
                texture.sRGBTexture=false;
                texture.mipmapEnabled=false;
                texture.wrapMode=TextureWrapMode.Clamp;
                texture.filterMode=FilterMode.Bilinear;
                texture.textureCompression=TextureImporterCompression.Uncompressed;
                texture.maxTextureSize=4096;
            }
            else if (assetPath.EndsWith("landmask.png"))
            {
                texture.sRGBTexture=false;
                texture.wrapMode=TextureWrapMode.Repeat;
                texture.filterMode=FilterMode.Bilinear;
            }
            else if (assetPath.EndsWith("earth-color.jpg"))
            {
                texture.sRGBTexture=true;
                texture.wrapMode=TextureWrapMode.Repeat;
                texture.filterMode=FilterMode.Trilinear;
                texture.mipmapEnabled=true;
            }
        }
    }
}

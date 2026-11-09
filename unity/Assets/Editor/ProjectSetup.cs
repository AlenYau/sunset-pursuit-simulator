using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace SunsetPursuit.Editor
{
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        private const string ScenePath = "Assets/Scenes/SunsetPursuit.unity";

        static ProjectSetup() { EditorApplication.delayCall += EnsureScene; }

        private static void EnsureScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) return;
            if (!File.Exists(ScenePath))
            {
                Directory.CreateDirectory("Assets/Scenes");
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
                EditorSceneManager.SaveScene(scene,ScenePath);
                Debug.Log("Created Sunset Pursuit Unity scene. Press Play to launch.");
            }
            if (EditorBuildSettings.scenes.Length != 1 || EditorBuildSettings.scenes[0].path != ScenePath)
                EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath,true) };
            if (SceneManager.GetActiveScene().path != ScenePath && !SceneManager.GetActiveScene().isDirty)
                EditorSceneManager.OpenScene(ScenePath);
        }

        [MenuItem("Sunset Pursuit/Build macOS")]
        public static void BuildMac()
        {
            EnsureScene();
            Directory.CreateDirectory("Builds");
            var options = new BuildPlayerOptions {
                scenes = new[] { ScenePath },
                locationPathName = "Builds/Sunset Pursuit.app",
                target = BuildTarget.StandaloneOSX,
                options = BuildOptions.None
            };
            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
                throw new System.Exception("macOS build failed: " + report.summary.result);
        }

        [MenuItem("Sunset Pursuit/Build Web")]
        public static void BuildWeb()
        {
            EnsureScene();
            Directory.CreateDirectory("Builds/Web");
            var options = new BuildPlayerOptions {
                scenes = new[] { ScenePath },
                locationPathName = "Builds/Web",
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            };
            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
                throw new System.Exception("Web build failed: " + report.summary.result);
        }
    }
}

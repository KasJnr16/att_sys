# DeepFace Seed Weights

Put pre-downloaded DeepFace model files in `weights/` if you want the Docker image to include them.

Expected paths:

```text
backend/deepface_seed/weights/facenet512_weights.h5
backend/deepface_seed/weights/2.7_80x80_MiniFASNetV2.pth
backend/deepface_seed/weights/4_0_0_80x80_MiniFASNetV1SE.pth
```

On container startup, `entrypoint.sh` copies any files in `weights/` into:

```text
$DEEPFACE_HOME/.deepface/weights
```

For Render, mount a persistent disk at the same path as `DEEPFACE_HOME`, for example `/var/data/deepface`, so downloaded or seeded weights survive restarts and redeploys.

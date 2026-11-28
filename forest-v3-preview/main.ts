import { launchForest } from '../forest-batch-b-preview/boot';
import { loadLandmarks } from '../forest-batch-c-preview/loadLandmarks';
import { alphaScene } from './scene';
import './alpha.css';

launchForest(loadLandmarks, undefined, alphaScene);
